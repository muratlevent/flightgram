import type { ProviderFlightQuote } from "../types/flight";

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
  ): Promise<ProviderFlightQuote | null>;
}
