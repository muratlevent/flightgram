-- Migration: Add user_budgets table for budget alerts
-- Users can set a global budget; any tracker dropping below it triggers an alert

CREATE TABLE IF NOT EXISTS user_budgets (
  user_id TEXT PRIMARY KEY,
  budget_amount REAL NOT NULL CHECK (budget_amount > 0),
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users (telegram_id) ON DELETE CASCADE
);
