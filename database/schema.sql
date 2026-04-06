CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tracked_flights (
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

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  price REAL NOT NULL CHECK (price > 0),
  checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES tracked_flights (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  price REAL NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL,
  deep_link TEXT,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES tracked_flights (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracked_flights_user_active
  ON tracked_flights (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tracked_flights_departure_active
  ON tracked_flights (departure_date_start, departure_date_end, is_active);

CREATE INDEX IF NOT EXISTS idx_price_history_flight_checked_at
  ON price_history (flight_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_alerts_flight_sent_at
  ON price_alerts (flight_id, sent_at DESC);
