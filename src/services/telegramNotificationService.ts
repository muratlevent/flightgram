import type { Telegram } from "telegraf";

import type { ProviderFlightQuote, TrackedFlightRow } from "../types/flight";
import { formatMoney, formatRoute } from "./formatting";

export class TelegramNotificationService {
  constructor(private readonly telegram: Telegram) {}

  async sendPriceAlert(
    flight: TrackedFlightRow,
    quote: ProviderFlightQuote,
  ): Promise<void> {
    const isDateRange =
      flight.departure_date_start !== flight.departure_date_end;

    const dateLabel = isDateRange
      ? `Date range: ${flight.departure_date_start} to ${flight.departure_date_end}`
      : `Departure date: ${flight.departure_date_start}`;

    const lines = [
      "Price alert triggered.",
      `Route: ${formatRoute(flight.origin_code, flight.destination_code)}`,
      dateLabel,
    ];

    // If it's a date range and we found a specific cheapest date, show it
    if (isDateRange && quote.departureDate) {
      lines.push(`Cheapest date: ${quote.departureDate}`);
    }

    lines.push(
      `Best price: ${formatMoney(quote.price, quote.currency)}`,
      `Target price: ${formatMoney(Number(flight.target_price), flight.currency)}`,
      `Provider: ${quote.providerName}`,
    );

    if (quote.deepLink) {
      lines.push(`Booking link: ${quote.deepLink}`);
    }

    await this.telegram.sendMessage(flight.user_id, lines.join("\n"));
  }
}
