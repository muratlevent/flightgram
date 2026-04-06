import type { PriceHistoryRepository } from "../repositories/priceHistoryRepository.js";
import type { TrackedFlightRepository } from "../repositories/trackedFlightRepository.js";
import type { TrackedFlightRow } from "../types/flight.js";
import {
  generatePriceHistoryChart,
  type ChartResult,
  type PriceDataPoint,
} from "./chartService.js";
import { formatRoute } from "./formatting.js";

export interface FlightHistoryResult {
  flight: TrackedFlightRow;
  chart: ChartResult;
  dataPoints: PriceDataPoint[];
}

export class PriceHistoryService {
  constructor(
    private readonly trackedFlightRepository: TrackedFlightRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
  ) {}

  /**
   * Get price history and chart for a specific tracker.
   */
  async getFlightHistory(
    flightId: string,
    userId: string,
    days: number = 14,
  ): Promise<FlightHistoryResult | null> {
    // Fetch all active flights for the user to validate ownership
    const userFlights = await this.trackedFlightRepository.listActiveFlightsForUser(userId);
    const flight = userFlights.find((f) => f.id === flightId);

    if (!flight) {
      return null;
    }

    const dataPoints = await this.priceHistoryRepository.getPriceHistoryForFlight(
      flightId,
      days,
    );

    const chart = generatePriceHistoryChart(
      dataPoints,
      flight.currency,
      flight.target_price,
    );

    return {
      flight,
      chart,
      dataPoints,
    };
  }

  /**
   * Format the history result as a message.
   */
  formatHistoryMessage(result: FlightHistoryResult): string {
    const { flight, chart, dataPoints } = result;
    const route = formatRoute(flight.origin_code, flight.destination_code);

    if (dataPoints.length === 0) {
      return [
        `<b>Price History: ${route}</b>`,
        "",
        "No price history available yet.",
        "Price data is collected during scheduled checks.",
      ].join("\n");
    }

    const lines = [
      `<b>Price History: ${route}</b>`,
      "",
      `<code>${chart.sparkline}</code>`,
      "",
      chart.summary,
      "",
      chart.details,
    ];

    return lines.join("\n");
  }
}
