import type { FlightProvider } from "../providers/flightProvider.js";
import type { CheapestDatesResult, ProviderFlightQuote } from "../types/flight.js";
import type { CheapestDatesOptions, FlightSearchOptions } from "../types/flightOptions.js";

export interface SearchResult {
  quotes: ProviderFlightQuote[];
  cheapest: ProviderFlightQuote | null;
}

export class FlightSearchService {
  constructor(private readonly providers: FlightProvider[]) {}

  /**
   * Perform a one-time flight search and return results.
   */
  async search(
    origin: string,
    destination: string,
    departureDate: string,
    currency: string,
    options?: FlightSearchOptions,
  ): Promise<SearchResult> {
    const settledQuotes = await Promise.allSettled(
      this.providers.map((provider) =>
        provider.getCheapestFlight(
          origin,
          destination,
          departureDate,
          currency,
          options,
        ),
      ),
    );

    const quotes = settledQuotes
      .flatMap((result) => {
        if (result.status === "fulfilled" && result.value) {
          return [result.value];
        }
        if (result.status === "rejected") {
          console.error("[search] Provider request failed", result.reason);
        }
        return [];
      })
      .filter((quote) => quote.currency === currency);

    const cheapest = quotes.reduce<ProviderFlightQuote | null>(
      (currentCheapest, candidate) => {
        if (!currentCheapest || candidate.price < currentCheapest.price) {
          return candidate;
        }
        return currentCheapest;
      },
      null,
    );

    return { quotes, cheapest };
  }

  /**
   * Search across a date range and return the cheapest option.
   */
  async searchRange(
    origin: string,
    destination: string,
    startDate: string,
    endDate: string,
    currency: string,
    options?: FlightSearchOptions,
  ): Promise<SearchResult> {
    const settledQuotes = await Promise.allSettled(
      this.providers.map((provider) =>
        provider.getCheapestFlightInRange(
          origin,
          destination,
          startDate,
          endDate,
          currency,
          options,
        ),
      ),
    );

    const quotes = settledQuotes
      .flatMap((result) => {
        if (result.status === "fulfilled" && result.value) {
          return [result.value];
        }
        if (result.status === "rejected") {
          console.error("[search] Provider request failed", result.reason);
        }
        return [];
      })
      .filter((quote) => quote.currency === currency);

    const cheapest = quotes.reduce<ProviderFlightQuote | null>(
      (currentCheapest, candidate) => {
        if (!currentCheapest || candidate.price < currentCheapest.price) {
          return candidate;
        }
        return currentCheapest;
      },
      null,
    );

    return { quotes, cheapest };
  }

  /**
   * Find cheapest dates in a range using optimized date search.
   */
  async searchCheapestDates(
    origin: string,
    destination: string,
    startDate: string,
    endDate: string,
    currency: string,
    options?: CheapestDatesOptions,
  ): Promise<CheapestDatesResult | null> {
    // Try each provider that supports getCheapestDates
    for (const provider of this.providers) {
      if (!provider.getCheapestDates) {
        continue;
      }

      try {
        const result = await provider.getCheapestDates(
          origin,
          destination,
          startDate,
          endDate,
          currency,
          options,
        );

        if (result && result.options.length > 0) {
          return result;
        }
      } catch (error) {
        console.error(
          `[search] Provider ${provider.name} cheapest dates failed`,
          error,
        );
      }
    }

    return null;
  }
}
