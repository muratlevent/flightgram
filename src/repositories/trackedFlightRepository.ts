import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import type {
  TrackedFlightInsert,
  TrackedFlightRow,
} from "../types/flight.js";
import type { CabinClass, MaxStops } from "../types/flightOptions.js";

interface RawTrackedFlightRow {
  id: string;
  user_id: string;
  origin_code: string;
  destination_code: string;
  departure_date_start: string;
  departure_date_end: string;
  return_date_start: string | null;
  return_date_end: string | null;
  cabin_class: CabinClass;
  max_stops: MaxStops;
  airlines: string | null;
  departure_time_start: string | null;
  departure_time_end: string | null;
  passengers: number;
  flexible_dates: number;
  target_price: number;
  currency: string;
  price_drop_percent: number | null;
  initial_price: number | null;
  is_active: number;
  created_at: string;
}

function mapTrackedFlightRow(row: RawTrackedFlightRow): TrackedFlightRow {
  return {
    id: row.id,
    user_id: row.user_id,
    origin_code: row.origin_code,
    destination_code: row.destination_code,
    departure_date_start: row.departure_date_start,
    departure_date_end: row.departure_date_end,
    return_date_start: row.return_date_start,
    return_date_end: row.return_date_end,
    cabin_class: row.cabin_class,
    max_stops: row.max_stops,
    airlines: row.airlines,
    departure_time_start: row.departure_time_start,
    departure_time_end: row.departure_time_end,
    passengers: row.passengers,
    flexible_dates: Boolean(row.flexible_dates),
    target_price: Number(row.target_price),
    currency: row.currency,
    price_drop_percent: row.price_drop_percent,
    initial_price: row.initial_price ? Number(row.initial_price) : null,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
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
        return_date_start,
        return_date_end,
        cabin_class,
        max_stops,
        airlines,
        departure_time_start,
        departure_time_end,
        passengers,
        flexible_dates,
        target_price,
        currency,
        price_drop_percent,
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
        @return_date_start,
        @return_date_end,
        @cabin_class,
        @max_stops,
        @airlines,
        @departure_time_start,
        @departure_time_end,
        @passengers,
        @flexible_dates,
        @target_price,
        @currency,
        @price_drop_percent,
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
      return_date_start: payload.return_date_start ?? null,
      return_date_end: payload.return_date_end ?? null,
      cabin_class: payload.cabin_class ?? 'ECONOMY',
      max_stops: payload.max_stops ?? 'ANY',
      airlines: payload.airlines ?? null,
      departure_time_start: payload.departure_time_start ?? null,
      departure_time_end: payload.departure_time_end ?? null,
      passengers: payload.passengers ?? 1,
      flexible_dates: payload.flexible_dates ?? false ? 1 : 0,
      target_price: payload.target_price,
      currency: payload.currency,
      price_drop_percent: payload.price_drop_percent ?? null,
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

  /**
   * Deactivate all trackers where the departure date has passed.
   * Returns the number of trackers deactivated.
   */
  async deactivateExpiredFlights(): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    
    const result = this.db
      .prepare(`
        UPDATE tracked_flights
        SET is_active = 0
        WHERE is_active = 1 AND departure_date_end < ?
      `)
      .run(today);

    return result.changes;
  }

  /**
   * Find existing active tracker with same route and overlapping dates.
   */
  async findDuplicateTracker(
    userId: string,
    originCode: string,
    destinationCode: string,
    departureDateStart: string,
    departureDateEnd: string,
  ): Promise<TrackedFlightRow | null> {
    // Check for overlapping date ranges on same route
    const row = this.db
      .prepare(`
        SELECT *
        FROM tracked_flights
        WHERE user_id = ?
          AND origin_code = ?
          AND destination_code = ?
          AND is_active = 1
          AND NOT (departure_date_end < ? OR departure_date_start > ?)
        LIMIT 1
      `)
      .get(
        userId,
        originCode,
        destinationCode,
        departureDateStart,
        departureDateEnd,
      ) as RawTrackedFlightRow | undefined;

    return row ? mapTrackedFlightRow(row) : null;
  }

  /**
   * Set the initial price for a tracker (only if not already set).
   * Returns true if updated, false if already set.
   */
  async setInitialPrice(flightId: string, price: number): Promise<boolean> {
    const result = this.db
      .prepare(`
        UPDATE tracked_flights
        SET initial_price = ?
        WHERE id = ? AND initial_price IS NULL
      `)
      .run(price, flightId);

    return result.changes > 0;
  }

  /**
   * Get a tracked flight by ID.
   */
  async getTrackedFlightById(id: string): Promise<TrackedFlightRow | null> {
    const row = this.db
      .prepare(`
        SELECT *
        FROM tracked_flights
        WHERE id = ?
      `)
      .get(id) as RawTrackedFlightRow | undefined;

    return row ? mapTrackedFlightRow(row) : null;
  }
}
