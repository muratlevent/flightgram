import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import type {
  TrackedFlightInsert,
  TrackedFlightRow,
} from "../types/flight";

interface RawTrackedFlightRow
  extends Omit<TrackedFlightRow, "is_active" | "target_price"> {
  is_active: number;
  target_price: number;
}

function mapTrackedFlightRow(row: RawTrackedFlightRow): TrackedFlightRow {
  return {
    ...row,
    target_price: Number(row.target_price),
    is_active: Boolean(row.is_active),
  };
}

export class TrackedFlightRepository {
  constructor(private readonly db: Database.Database) {}

  async createTrackedFlight(
    payload: TrackedFlightInsert,
  ): Promise<TrackedFlightRow> {
    const trackedFlightId = payload.id ?? randomUUID();
    const insertTrackedFlightStatement = this.db.prepare(`
      INSERT INTO tracked_flights (
        id,
        user_id,
        origin_code,
        destination_code,
        departure_date_start,
        departure_date_end,
        target_price,
        currency,
        is_active,
        created_at
      )
      VALUES (
        @id,
        @user_id,
        @origin_code,
        @destination_code,
        @departure_date_start,
        @departure_date_end,
        @target_price,
        @currency,
        @is_active,
        @created_at
      )
    `);

    insertTrackedFlightStatement.run({
      id: trackedFlightId,
      user_id: payload.user_id,
      origin_code: payload.origin_code,
      destination_code: payload.destination_code,
      departure_date_start: payload.departure_date_start,
      departure_date_end: payload.departure_date_end,
      target_price: payload.target_price,
      currency: payload.currency,
      is_active: payload.is_active ?? true ? 1 : 0,
      created_at: payload.created_at ?? new Date().toISOString(),
    });

    const trackedFlight = this.db
      .prepare(`
        SELECT *
        FROM tracked_flights
        WHERE id = ?
      `)
      .get(trackedFlightId) as RawTrackedFlightRow | undefined;

    if (!trackedFlight) {
      throw new Error("Failed to create tracked flight: no row returned.");
    }

    return mapTrackedFlightRow(trackedFlight);
  }

  async listActiveFlightsForUser(userId: string): Promise<TrackedFlightRow[]> {
    const rows = this.db
      .prepare(`
        SELECT *
        FROM tracked_flights
        WHERE user_id = ? AND is_active = 1
        ORDER BY departure_date_start ASC, created_at ASC
      `)
      .all(userId) as RawTrackedFlightRow[];

    return rows.map(mapTrackedFlightRow);
  }

  async listAllActiveFlights(): Promise<TrackedFlightRow[]> {
    const rows = this.db
      .prepare(`
        SELECT *
        FROM tracked_flights
        WHERE is_active = 1
        ORDER BY departure_date_start ASC, created_at ASC
      `)
      .all() as RawTrackedFlightRow[];

    return rows.map(mapTrackedFlightRow);
  }

  async deactivateTrackedFlight(
    id: string,
    userId: string,
  ): Promise<TrackedFlightRow | null> {
    const updateResult = this.db
      .prepare(`
        UPDATE tracked_flights
        SET is_active = 0
        WHERE id = ? AND user_id = ? AND is_active = 1
      `)
      .run(id, userId);

    if (updateResult.changes === 0) {
      return null;
    }

    const trackedFlight = this.db
      .prepare(`
        SELECT *
        FROM tracked_flights
        WHERE id = ? AND user_id = ?
      `)
      .get(id, userId) as RawTrackedFlightRow | undefined;

    return trackedFlight ? mapTrackedFlightRow(trackedFlight) : null;
  }
}
