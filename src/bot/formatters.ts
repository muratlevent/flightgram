import type { TrackedFlightRow } from "../types/flight.js";
import { formatMoney, formatRoute } from "../services/formatting.js";
import {
  CABIN_CLASS_EMOJIS,
  CABIN_CLASS_LABELS,
  MAX_STOPS_EMOJIS,
  MAX_STOPS_LABELS,
} from "../types/flightOptions.js";

function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return start;
  }
  return `${start} to ${end}`;
}

export function formatTrackedFlightSummary(flight: TrackedFlightRow): string {
  const lines = [
    `ID: ${flight.id}`,
    `Route: ${formatRoute(flight.origin_code, flight.destination_code)}`,
    `Departure: ${formatDateRange(flight.departure_date_start, flight.departure_date_end)}`,
  ];

  // Add return date if round-trip
  if (flight.return_date_start && flight.return_date_end) {
    lines.push(`Return: ${formatDateRange(flight.return_date_start, flight.return_date_end)}`);
  }

  // Add cabin class if not default
  if (flight.cabin_class && flight.cabin_class !== "ECONOMY") {
    const emoji = CABIN_CLASS_EMOJIS[flight.cabin_class];
    const label = CABIN_CLASS_LABELS[flight.cabin_class];
    lines.push(`Class: ${emoji} ${label}`);
  }

  // Add stops if not "ANY"
  if (flight.max_stops && flight.max_stops !== "ANY") {
    const emoji = MAX_STOPS_EMOJIS[flight.max_stops];
    const label = MAX_STOPS_LABELS[flight.max_stops];
    lines.push(`Stops: ${emoji} ${label}`);
  }

  // Add airlines if specified
  if (flight.airlines) {
    try {
      const airlineList = JSON.parse(flight.airlines) as string[];
      if (airlineList.length > 0) {
        lines.push(`Airlines: ${airlineList.join(", ")}`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Add departure time window if specified
  if (flight.departure_time_start && flight.departure_time_end) {
    lines.push(`Departure time: ${flight.departure_time_start}:00 - ${flight.departure_time_end}:00`);
  }

  // Add passengers if more than 1
  if (flight.passengers && flight.passengers > 1) {
    lines.push(`Passengers: ${flight.passengers}`);
  }

  lines.push(`Target price: ${formatMoney(Number(flight.target_price), flight.currency)}`);
  lines.push(`Status: ${flight.is_active ? "Active" : "Inactive"}`);

  return lines.join("\n");
}

export function formatTrackedFlightList(flights: TrackedFlightRow[]): string {
  return flights
    .map((flight, index) => `${index + 1}.\n${formatTrackedFlightSummary(flight)}`)
    .join("\n\n");
}
