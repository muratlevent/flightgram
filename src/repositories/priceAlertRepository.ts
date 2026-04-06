import type Database from "better-sqlite3";

import type { PriceAlertInsert, PriceAlertRow } from "../types/flight.js";

export class PriceAlertRepository {
  constructor(private readonly db: Database.Database) {}

  async getLatestAlertForFlight(flightId: string): Promise<PriceAlertRow | null> {
    const row = this.db
      .prepare(`
        SELECT id, flight_id, provider_name, price, currency, deep_link, sent_at
        FROM price_alerts
        WHERE flight_id = ?
        ORDER BY sent_at DESC, id DESC
        LIMIT 1
      `)
      .get(flightId) as PriceAlertRow | undefined;

    return row ?? null;
  }

  async recordAlert(entry: PriceAlertInsert): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO price_alerts (
          flight_id,
          provider_name,
          price,
          currency,
          deep_link,
          sent_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.flight_id,
        entry.provider_name,
        entry.price,
        entry.currency,
        entry.deep_link ?? null,
        entry.sent_at ?? new Date().toISOString(),
      );
  }
}
