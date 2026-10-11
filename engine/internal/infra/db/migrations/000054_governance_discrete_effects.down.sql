-- Descarta os efeitos novos (política e prêmio da PN) e volta ao formato anterior.
DELETE FROM governance_decision_effects WHERE metric IN ('dividend_policy', 'pn_dividend_premium_pct') OR status = 'skipped_not_applicable';
ALTER TABLE governance_decision_effects DROP CONSTRAINT governance_decision_effects_shape_check;
ALTER TABLE governance_decision_effects DROP CONSTRAINT governance_decision_effects_status_check;
ALTER TABLE governance_decision_effects ADD CONSTRAINT governance_decision_effects_status_check
  CHECK (status IN ('scheduled', 'completed', 'skipped_cooldown', 'skipped_out_of_range'));
ALTER TABLE governance_decision_effects DROP CONSTRAINT governance_decision_effects_metric_check;
ALTER TABLE governance_decision_effects ADD CONSTRAINT governance_decision_effects_metric_check
  CHECK (metric IN ('base_growth_pct', 'quality_multiplier', 'payout_ratio_pct'));
ALTER TABLE governance_decision_effects ALTER COLUMN direction SET NOT NULL;
ALTER TABLE governance_decision_effects ALTER COLUMN intensity SET NOT NULL;
ALTER TABLE governance_decision_effects DROP COLUMN target_value;
