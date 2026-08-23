DROP TABLE IF EXISTS dividend_event_recipients;
DROP INDEX IF EXISTS dividend_events_pending_payment_idx;
ALTER TABLE dividend_events
  DROP COLUMN paid,
  DROP COLUMN payment_day;
