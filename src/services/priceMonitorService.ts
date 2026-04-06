import type { FlightProvider } from "../providers/flightProvider";
import { PriceAlertRepository } from "../repositories/priceAlertRepository";
import { PriceHistoryRepository } from "../repositories/priceHistoryRepository";
import { TrackedFlightRepository } from "../repositories/trackedFlightRepository";
import { TelegramNotificationService } from "./telegramNotificationService";

export class PriceMonitorService {
  private static readonly ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1_000;

  constructor(
    private readonly trackedFlightRepository: TrackedFlightRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly priceAlertRepository: PriceAlertRepository,
    private readonly notificationService: TelegramNotificationService,
    private readonly providers: FlightProvider[],
  ) {}

  async runCycle(): Promise<void> {
    const trackedFlights = await this.trackedFlightRepository.listAllActiveFlights();

    console.info(
      `[scheduler] Checking ${trackedFlights.length} tracked flights with ${this.providers.length} providers.`,
    );

    for (const trackedFlight of trackedFlights) {
      await this.checkTrackedFlight(trackedFlight);
    }
  }

  private async checkTrackedFlight(
    trackedFlight: Awaited<
      ReturnType<TrackedFlightRepository["listAllActiveFlights"]>
    >[number],
  ): Promise<void> {
    const settledQuotes = await Promise.allSettled(
      this.providers.map((provider) =>
        provider.getCheapestFlightInRange(
          trackedFlight.origin_code,
          trackedFlight.destination_code,
          trackedFlight.departure_date_start,
          trackedFlight.departure_date_end,
          trackedFlight.currency,
        ),
      ),
    );

    const quotes = settledQuotes
      .flatMap((result) => {
        if (result.status === "fulfilled" && result.value) {
          return [result.value];
        }

        if (result.status === "rejected") {
          console.error("[scheduler] Provider request failed", result.reason);
        }

        return [];
      })
      .filter((quote) => quote.currency === trackedFlight.currency);

    await this.priceHistoryRepository.recordPriceChecks(
      quotes.map((quote) => ({
        flight_id: trackedFlight.id,
        provider_name: quote.providerName,
        price: quote.price,
        checked_at: quote.checkedAt,
      })),
    );

    const cheapestQuote = quotes.reduce<typeof quotes[number] | null>(
      (currentCheapest, candidate) => {
        if (!currentCheapest || candidate.price < currentCheapest.price) {
          return candidate;
        }

        return currentCheapest;
      },
      null,
    );

    const dateRangeStr =
      trackedFlight.departure_date_start === trackedFlight.departure_date_end
        ? trackedFlight.departure_date_start
        : `${trackedFlight.departure_date_start} to ${trackedFlight.departure_date_end}`;

    if (!cheapestQuote) {
      console.info(
        `[scheduler] No quote returned for ${trackedFlight.origin_code} -> ${trackedFlight.destination_code} on ${dateRangeStr}.`,
      );
      return;
    }

    if (cheapestQuote.price <= Number(trackedFlight.target_price)) {
      const shouldNotify = await this.shouldSendAlert(
        trackedFlight.id,
        cheapestQuote.price,
      );

      if (!shouldNotify) {
        console.info(
          `[scheduler] Alert suppressed for ${trackedFlight.id} because a recent alert already exists.`,
        );
        return;
      }

      await this.notificationService.sendPriceAlert(trackedFlight, cheapestQuote);
      await this.priceAlertRepository.recordAlert({
        flight_id: trackedFlight.id,
        provider_name: cheapestQuote.providerName,
        price: cheapestQuote.price,
        currency: cheapestQuote.currency,
        deep_link: cheapestQuote.deepLink ?? null,
        sent_at: cheapestQuote.checkedAt,
      });
    }
  }

  private async shouldSendAlert(
    trackedFlightId: string,
    currentPrice: number,
  ): Promise<boolean> {
    const lastAlert =
      await this.priceAlertRepository.getLatestAlertForFlight(trackedFlightId);

    if (!lastAlert) {
      return true;
    }

    if (currentPrice < lastAlert.price) {
      return true;
    }

    const elapsedMs = Date.now() - new Date(lastAlert.sent_at).getTime();
    return elapsedMs >= PriceMonitorService.ALERT_COOLDOWN_MS;
  }
}
