import type { FlightProvider } from "../providers/flightProvider.js";
import { PriceAlertRepository } from "../repositories/priceAlertRepository.js";
import { PriceHistoryRepository } from "../repositories/priceHistoryRepository.js";
import { TrackedFlightRepository } from "../repositories/trackedFlightRepository.js";
import type { FlightSearchOptions } from "../types/flightOptions.js";
import { TelegramNotificationService } from "./telegramNotificationService.js";

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
    // First, deactivate any expired trackers
    const expiredCount = await this.trackedFlightRepository.deactivateExpiredFlights();
    if (expiredCount > 0) {
      console.info(`[scheduler] Deactivated ${expiredCount} expired tracker(s).`);
    }

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
    // Build search options from tracked flight
    const searchOptions: FlightSearchOptions = {};

    // For round-trip, use the first return date (we search one date at a time)
    if (trackedFlight.return_date_start) {
      searchOptions.returnDate = trackedFlight.return_date_start;
    }

    if (trackedFlight.cabin_class && trackedFlight.cabin_class !== "ECONOMY") {
      searchOptions.cabinClass = trackedFlight.cabin_class;
    }

    if (trackedFlight.max_stops && trackedFlight.max_stops !== "ANY") {
      searchOptions.maxStops = trackedFlight.max_stops;
    }

    if (trackedFlight.airlines) {
      try {
        const airlineList = JSON.parse(trackedFlight.airlines) as string[];
        if (airlineList.length > 0) {
          searchOptions.airlines = airlineList;
        }
      } catch {
        // Ignore parse errors
      }
    }

    if (trackedFlight.departure_time_start && trackedFlight.departure_time_end) {
      searchOptions.departureTimeWindow = `${trackedFlight.departure_time_start}-${trackedFlight.departure_time_end}`;
    }

    if (trackedFlight.passengers && trackedFlight.passengers > 1) {
      searchOptions.passengers = trackedFlight.passengers;
    }

    const settledQuotes = await Promise.allSettled(
      this.providers.map((provider) =>
        provider.getCheapestFlightInRange(
          trackedFlight.origin_code,
          trackedFlight.destination_code,
          trackedFlight.departure_date_start,
          trackedFlight.departure_date_end,
          trackedFlight.currency,
          searchOptions,
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
