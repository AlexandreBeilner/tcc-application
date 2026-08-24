ALTER TABLE macro_events
  DROP COLUMN triggered_on_day,
  DROP COLUMN duration_days,
  DROP COLUMN price_effect_pct,
  DROP COLUMN fundamentals_effect_pct,
  DROP COLUMN fundamentals_report_day;
