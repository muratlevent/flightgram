import type Database from "better-sqlite3";

import type { PriceHistoryInsert } from "../types/flight.js";

export class PriceHistoryRepository {
  constructor(private readonly db: Database.Database) {}

  async recordPriceChecks(entries: PriceHistoryInsert[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const insertStatement = this.db.prepare(`
      INSERT INTO price_history (
        flight_id,
        provider_name,
        price,
        checked_at
      )
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((priceEntries: PriceHistoryInsert[]) => {
      for (const entry of priceEntries) {
        insertStatement.run(
          entry.flight_id,
          entry.provider_name,
          entry.price,
          entry.checked_at ?? new Date().toISOString(),
        );
      }
    });

    insertMany(entries);
  }
}
