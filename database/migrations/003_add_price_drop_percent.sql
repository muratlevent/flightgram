-- Migration: Add price_drop_percent and initial_price columns
-- This enables percentage-based price drop alerts

-- Add price_drop_percent column (nullable, NULL = disabled)
-- Values 1-100 represent the percentage drop threshold
ALTER TABLE tracked_flights ADD COLUMN price_drop_percent INTEGER CHECK (price_drop_percent IS NULL OR (price_drop_percent >= 1 AND price_drop_percent <= 100));

-- Add initial_price column to track the first recorded price
-- This is set when the first price is recorded for a tracker
ALTER TABLE tracked_flights ADD COLUMN initial_price REAL CHECK (initial_price IS NULL OR initial_price > 0);
