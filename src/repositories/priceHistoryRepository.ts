import type Database from "better-sqlite3";

import type { PriceHistoryInsert } from "../types/flight.js";

export interface PriceHistoryRow {
  id: number;
  flight_id: string;
  provider_name: string;
  price: number;
  checked_at: string;
}

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

  /**
   * Get the latest price check for a tracked flight.
   */
  async getLatestPriceForFlight(flightId: string): Promise<PriceHistoryRow | null> {
    const row = this.db
      .prepare(`
        SELECT *
        FROM price_history
        WHERE flight_id = ?
        ORDER BY checked_at DESC
        LIMIT 1
      `)
      .get(flightId) as PriceHistoryRow | undefined;

    return row ?? null;
  }

  /**
   * Get the price from approximately 7 days ago for trend comparison.
   */
  async getPriceFromDaysAgo(flightId: string, days: number): Promise<PriceHistoryRow | null> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const targetDateStr = targetDate.toISOString();

    // Get the price closest to the target date
    const row = this.db
      .prepare(`
        SELECT *
        FROM price_history
        WHERE flight_id = ?
          AND checked_at <= ?
        ORDER BY checked_at DESC
        LIMIT 1
      `)
      .get(flightId, targetDateStr) as PriceHistoryRow | undefined;

    return row ?? null;
  }

  /**
   * Get price history for a flight over the last N days.
   * Returns one price per day (the minimum price for that day).
   */
  async getPriceHistoryForFlight(
    flightId: string,
    days: number = 14,
  ): Promise<Array<{ date: string; minPrice: number; maxPrice: number; avgPrice: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    const rows = this.db
      .prepare(`
        SELECT 
          date(checked_at) as date,
          MIN(price) as minPrice,
          MAX(price) as maxPrice,
          AVG(price) as avgPrice
        FROM price_history
        WHERE flight_id = ?
          AND checked_at >= ?
        GROUP BY date(checked_at)
        ORDER BY date ASC
      `)
      .all(flightId, startDateStr) as Array<{
        date: string;
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
      }>;

    return rows;
  }
}
