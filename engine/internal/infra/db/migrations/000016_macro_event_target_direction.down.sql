ALTER TABLE macro_event_targets
  DROP CONSTRAINT macro_event_targets_direction_signed_chk,
  DROP COLUMN direction,
  DROP COLUMN price_effect_pct,
  DROP COLUMN fundamentals_effect_pct;
