-- Volta ao formato de um efeito por decisão. Só o efeito de posição 0 sobrevive (o segundo
-- efeito de uma decisão composta é perdido), e o payout por empresa some.
ALTER TABLE governance_decisions
  ADD COLUMN metric text, ADD COLUMN direction smallint, ADD COLUMN intensity numeric(4, 3),
  ADD COLUMN status text, ADD COLUMN total_delta integer, ADD COLUMN ramp_ticks integer,
  ADD COLUMN start_day integer, ADD COLUMN applied_ticks integer NOT NULL DEFAULT 0,
  ADD COLUMN applied_delta integer NOT NULL DEFAULT 0;

UPDATE governance_decisions d
SET metric = e.metric, direction = e.direction, intensity = e.intensity, status = e.status,
    total_delta = e.total_delta, ramp_ticks = e.ramp_ticks, start_day = e.start_day,
    applied_ticks = e.applied_ticks, applied_delta = e.applied_delta
FROM governance_decision_effects e
WHERE e.decision_id = d.id AND e.position = 0;

DELETE FROM governance_decisions WHERE metric IS NULL;
DELETE FROM governance_decisions WHERE metric = 'payout_ratio_pct';

ALTER TABLE governance_decisions
  ALTER COLUMN metric SET NOT NULL, ALTER COLUMN direction SET NOT NULL, ALTER COLUMN intensity SET NOT NULL,
  ALTER COLUMN status SET NOT NULL, ALTER COLUMN total_delta SET NOT NULL, ALTER COLUMN ramp_ticks SET NOT NULL,
  ALTER COLUMN start_day SET NOT NULL,
  ADD CONSTRAINT governance_decisions_metric_check CHECK (metric IN ('base_growth_pct', 'quality_multiplier')),
  ADD CONSTRAINT governance_decisions_direction_check CHECK (direction IN (-1, 1)),
  ADD CONSTRAINT governance_decisions_status_check CHECK (status IN ('scheduled', 'completed', 'skipped_cooldown', 'skipped_out_of_range'));

DROP TABLE governance_decision_effects;
CREATE INDEX governance_decisions_company_idx ON governance_decisions (company_id, start_day);
CREATE INDEX governance_decisions_status_idx ON governance_decisions (status) WHERE status = 'scheduled';
ALTER TABLE companies DROP COLUMN payout_ratio_pct;
