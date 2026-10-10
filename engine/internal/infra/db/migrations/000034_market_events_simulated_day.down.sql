DROP INDEX IF EXISTS market_events_user_day_idx;
ALTER TABLE market_events DROP COLUMN IF EXISTS simulated_day;
