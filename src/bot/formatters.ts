import type { TrackedFlightRow } from "../types/flight";
import { formatMoney, formatRoute } from "../services/formatting";

function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return start;
  }
  return `${start} to ${end}`;
}

export function formatTrackedFlightSummary(flight: TrackedFlightRow): string {
  return [
    `ID: ${flight.id}`,
    `Route: ${formatRoute(flight.origin_code, flight.destination_code)}`,
    `Departure: ${formatDateRange(flight.departure_date_start, flight.departure_date_end)}`,
    `Target price: ${formatMoney(Number(flight.target_price), flight.currency)}`,
    `Status: ${flight.is_active ? "Active" : "Inactive"}`,
  ].join("\n");
}

export function formatTrackedFlightList(flights: TrackedFlightRow[]): string {
  return flights
    .map((flight, index) => `${index + 1}.\n${formatTrackedFlightSummary(flight)}`)
    .join("\n\n");
}
