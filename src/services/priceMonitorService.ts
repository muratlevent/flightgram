import type { FlightProvider } from "../providers/flightProvider.js";
import { PriceAlertRepository } from "../repositories/priceAlertRepository.js";
import { PriceHistoryRepository } from "../repositories/priceHistoryRepository.js";
import { TrackedFlightRepository } from "../repositories/trackedFlightRepository.js";
import type { TrackedFlightRow } from "../types/flight.js";
import type { FlightSearchOptions } from "../types/flightOptions.js";
import { TelegramNotificationService } from "./telegramNotificationService.js";

interface AlertCheckResult {
  shouldAlert: boolean;
  reason: "target_price" | "price_drop_percent" | null;
  percentDrop?: number;
}

export class PriceMonitorService {
  private static readonly ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1_000;
  private static readonly FLEXIBLE_DATE_DAYS = 3;

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
    const dateRange = this.getSearchDateRange(trackedFlight);

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
          dateRange.start,
          dateRange.end,
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
      dateRange.start === dateRange.end
        ? dateRange.start
        : `${dateRange.start} to ${dateRange.end}`;

    if (!cheapestQuote) {
      console.info(
        `[scheduler] No quote returned for ${trackedFlight.origin_code} -> ${trackedFlight.destination_code} on ${dateRangeStr}.`,
      );
      return;
    }

    // Set initial price if not already set (first price check)
    if (trackedFlight.initial_price === null) {
      await this.trackedFlightRepository.setInitialPrice(
        trackedFlight.id,
        cheapestQuote.price,
      );
      console.info(
        `[scheduler] Set initial price ${cheapestQuote.price} for ${trackedFlight.id}`,
      );
      // Update local copy for percentage check
      trackedFlight.initial_price = cheapestQuote.price;
    }

    // Check if alert should be triggered
    const alertCheck = this.checkAlertConditions(trackedFlight, cheapestQuote.price);

    if (alertCheck.shouldAlert) {
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

      await this.notificationService.sendPriceAlert(
        trackedFlight,
        cheapestQuote,
        alertCheck.reason === "price_drop_percent" ? alertCheck.percentDrop : undefined,
      );
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

  /**
   * Check if alert conditions are met (target price OR percentage drop).
   */
  private checkAlertConditions(
    trackedFlight: TrackedFlightRow,
    currentPrice: number,
  ): AlertCheckResult {
    const targetPrice = Number(trackedFlight.target_price);

    // Check target price first
    if (currentPrice <= targetPrice) {
      return { shouldAlert: true, reason: "target_price" };
    }

    // Check percentage drop if enabled and initial price is set
    if (
      trackedFlight.price_drop_percent !== null &&
      trackedFlight.initial_price !== null
    ) {
      const initialPrice = trackedFlight.initial_price;
      const percentDrop = ((initialPrice - currentPrice) / initialPrice) * 100;

      if (percentDrop >= trackedFlight.price_drop_percent) {
        return {
          shouldAlert: true,
          reason: "price_drop_percent",
          percentDrop: Math.round(percentDrop),
        };
      }
    }

    return { shouldAlert: false, reason: null };
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

  private getSearchDateRange(
    trackedFlight: TrackedFlightRow,
  ): { start: string; end: string } {
    let start = trackedFlight.departure_date_start;
    let end = trackedFlight.departure_date_end;

    if (trackedFlight.flexible_dates) {
      start = this.shiftIsoDate(start, -PriceMonitorService.FLEXIBLE_DATE_DAYS);
      end = this.shiftIsoDate(end, PriceMonitorService.FLEXIBLE_DATE_DAYS);

      const today = this.getTodayIsoDate();
      if (start < today) {
        start = today;
      }
    }

    if (end < start) {
      end = start;
    }

    return { start, end };
  }

  private shiftIsoDate(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split("T")[0];
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    return todayUtc.toISOString().split("T")[0];
  }
}
