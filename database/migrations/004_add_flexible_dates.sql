-- Migration: Add flexible_dates column
-- When enabled, price monitor will expand search +/- 3 days around specified dates

ALTER TABLE tracked_flights ADD COLUMN flexible_dates INTEGER NOT NULL DEFAULT 0 CHECK (flexible_dates IN (0, 1));
