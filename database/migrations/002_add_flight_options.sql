-- Migration: Add flight search options to tracked_flights
-- Adds support for: round-trip, cabin class, stops filter, airline filter,
-- departure time window, and passenger count

-- Step 1: Create new table with all columns
CREATE TABLE IF NOT EXISTS tracked_flights_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  origin_code TEXT NOT NULL CHECK (length(origin_code) = 3),
  destination_code TEXT NOT NULL CHECK (length(destination_code) = 3),
  departure_date_start TEXT NOT NULL,
  departure_date_end TEXT NOT NULL,
  -- Round-trip return dates (nullable for one-way flights)
  return_date_start TEXT,
  return_date_end TEXT,
  -- Flight search options
  cabin_class TEXT NOT NULL DEFAULT 'ECONOMY' CHECK (cabin_class IN ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST')),
  max_stops TEXT NOT NULL DEFAULT 'ANY' CHECK (max_stops IN ('ANY', 'NON_STOP', 'ONE_STOP', 'TWO_PLUS_STOPS')),
  airlines TEXT,  -- JSON array: '["TK","BA"]' or NULL for any
  departure_time_start TEXT,  -- "06:00" format or NULL for any
  departure_time_end TEXT,    -- "20:00" format or NULL for any
  passengers INTEGER NOT NULL DEFAULT 1 CHECK (passengers >= 1 AND passengers <= 9),
  -- Price tracking
  target_price REAL NOT NULL CHECK (target_price > 0),
  currency TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users (telegram_id) ON DELETE CASCADE,
  CHECK (departure_date_end >= departure_date_start),
  CHECK (return_date_end IS NULL OR return_date_end >= return_date_start)
);

-- Step 2: Copy existing data with default values for new columns
INSERT INTO tracked_flights_new (
  id, user_id, origin_code, destination_code,
  departure_date_start, departure_date_end,
  return_date_start, return_date_end,
  cabin_class, max_stops, airlines,
  departure_time_start, departure_time_end, passengers,
  target_price, currency, is_active, created_at
)
SELECT
  id, user_id, origin_code, destination_code,
  departure_date_start, departure_date_end,
  NULL, NULL,  -- return dates (one-way by default)
  'ECONOMY', 'ANY', NULL,  -- cabin, stops, airlines
  NULL, NULL, 1,  -- time window, passengers
  target_price, currency, is_active, created_at
FROM tracked_flights;

-- Step 3: Drop old table
DROP TABLE tracked_flights;

-- Step 4: Rename new table
ALTER TABLE tracked_flights_new RENAME TO tracked_flights;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_tracked_flights_user_active
  ON tracked_flights (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tracked_flights_departure_active
  ON tracked_flights (departure_date_start, departure_date_end, is_active);
