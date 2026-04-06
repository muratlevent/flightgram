-- Migration: Add date range support to tracked_flights
-- This converts departure_date to departure_date_start and departure_date_end

-- Step 1: Create new table with date range columns
CREATE TABLE IF NOT EXISTS tracked_flights_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  origin_code TEXT NOT NULL CHECK (length(origin_code) = 3),
  destination_code TEXT NOT NULL CHECK (length(destination_code) = 3),
  departure_date_start TEXT NOT NULL,
  departure_date_end TEXT NOT NULL,
  target_price REAL NOT NULL CHECK (target_price > 0),
  currency TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users (telegram_id) ON DELETE CASCADE,
  CHECK (departure_date_end >= departure_date_start)
);

-- Step 2: Copy existing data (single date becomes both start and end)
INSERT INTO tracked_flights_new (
  id, user_id, origin_code, destination_code, 
  departure_date_start, departure_date_end,
  target_price, currency, is_active, created_at
)
SELECT 
  id, user_id, origin_code, destination_code,
  departure_date, departure_date,
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
