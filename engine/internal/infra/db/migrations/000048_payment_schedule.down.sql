ALTER TABLE market_calendar DROP COLUMN schedule_cutover_day;
DROP INDEX dividend_events_pending_snapshot_idx;
ALTER TABLE dividend_events DROP COLUMN recipients_snapshotted, DROP COLUMN ex_day, DROP COLUMN declared_day;
ALTER TABLE fii_details DROP COLUMN schedule_assigned, DROP COLUMN payout_business_day;
ALTER TABLE companies
  DROP COLUMN schedule_assigned, DROP COLUMN payment_lag_days, DROP COLUMN com_lag_days,
  DROP COLUMN dividend_policy, DROP COLUMN report_offset_days;
