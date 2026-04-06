import type { Telegram } from "telegraf";

import type { ProviderFlightQuote, TrackedFlightRow } from "../types/flight.js";
import {
  CABIN_CLASS_EMOJIS,
  CABIN_CLASS_LABELS,
} from "../types/flightOptions.js";
import { formatMoney, formatRoute } from "./formatting.js";

export class TelegramNotificationService {
  constructor(private readonly telegram: Telegram) {}

  async sendPriceAlert(
    flight: TrackedFlightRow,
    quote: ProviderFlightQuote,
    percentDrop?: number,
  ): Promise<void> {
    const isDateRange =
      flight.departure_date_start !== flight.departure_date_end;

    const dateLabel = isDateRange
      ? `Date range: ${flight.departure_date_start} to ${flight.departure_date_end}`
      : `Departure date: ${flight.departure_date_start}`;

    // Build alert header based on trigger type
    let alertHeader: string;
    if (percentDrop !== undefined) {
      alertHeader = `Price dropped ${percentDrop}%!`;
    } else {
      alertHeader = "Price alert triggered.";
    }

    const lines = [
      alertHeader,
      `Route: ${formatRoute(flight.origin_code, flight.destination_code)}`,
      dateLabel,
    ];

    // If it's a date range and we found a specific cheapest date, show it
    if (isDateRange && quote.departureDate) {
      lines.push(`Cheapest date: ${quote.departureDate}`);
    }

    // Show return date for round-trip
    if (quote.returnDate) {
      lines.push(`Return date: ${quote.returnDate}`);
    } else if (flight.return_date_start) {
      // Show tracked return date if no specific quote return
      const returnRange = flight.return_date_start === flight.return_date_end
        ? flight.return_date_start
        : `${flight.return_date_start} to ${flight.return_date_end}`;
      lines.push(`Return: ${returnRange}`);
    }

    // Show cabin class if not economy
    if (flight.cabin_class && flight.cabin_class !== "ECONOMY") {
      const emoji = CABIN_CLASS_EMOJIS[flight.cabin_class];
      const label = CABIN_CLASS_LABELS[flight.cabin_class];
      lines.push(`Class: ${emoji} ${label}`);
    }

    // Show passengers if more than 1
    if (flight.passengers && flight.passengers > 1) {
      lines.push(`Passengers: ${flight.passengers}`);
    }

    lines.push(
      `Best price: ${formatMoney(quote.price, quote.currency)}`,
    );

    // Show initial price and percentage for percentage alerts
    if (percentDrop !== undefined && flight.initial_price !== null) {
      lines.push(`Initial price: ${formatMoney(flight.initial_price, flight.currency)}`);
    }

    lines.push(
      `Target price: ${formatMoney(Number(flight.target_price), flight.currency)}`,
      `Provider: ${quote.providerName}`,
    );

    if (quote.deepLink) {
      lines.push(`Booking link: ${quote.deepLink}`);
    }

    await this.telegram.sendMessage(flight.user_id, lines.join("\n"));
  }
}
