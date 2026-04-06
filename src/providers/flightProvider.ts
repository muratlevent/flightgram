import type { ProviderFlightQuote } from "../types/flight.js";
import type { FlightSearchOptions } from "../types/flightOptions.js";

export interface FlightProvider {
  readonly name: string;

  /**
   * Get the cheapest flight for a single date.
   */
  getCheapestFlight(
    origin: string,
    destination: string,
    date: string,
    currency?: string,
    options?: FlightSearchOptions,
  ): Promise<ProviderFlightQuote | null>;

  /**
   * Get the cheapest flight across a date range.
   * Returns the single cheapest quote found across all dates in the range.
   */
  getCheapestFlightInRange(
    origin: string,
    destination: string,
    startDate: string,
    endDate: string,
    currency?: string,
    options?: FlightSearchOptions,
  ): Promise<ProviderFlightQuote | null>;
}
