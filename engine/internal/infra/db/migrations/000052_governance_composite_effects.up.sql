-- Tarefa MO.6.10 (backlog-monetizacao.md, Fase F2): payout por empresa e efeito composto.
--
-- 1) companies.payout_ratio_pct: fração do lucro distribuída em cada balanço, decidida em
--    assembleia. Padrão 50, o valor da constante global que valia até aqui
--    (dividend.DefaultEquityPayoutRatio), então nada muda para quem nunca teve decisão.
ALTER TABLE companies ADD COLUMN payout_ratio_pct numeric(5, 2) NOT NULL DEFAULT 50
  CHECK (payout_ratio_pct >= 0 AND payout_ratio_pct <= 100);

-- 2) Uma decisão passa a ter de 1 a 2 efeitos, em alavancas diferentes. O que era coluna da
--    decisão (métrica, sentido, intensidade e andamento da rampa) vira uma linha em
--    governance_decision_effects; as decisões já gravadas viram o efeito de posição 0.
CREATE TABLE governance_decision_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES governance_decisions(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  position smallint NOT NULL CHECK (position IN (0, 1)),
  -- O evento imutável deste efeito em market_events (um por efeito). Nulo só nas decisões
  -- gravadas antes desta migração, que tinham um único evento sem ligação.
  event_id uuid REFERENCES market_events(id),
  metric text NOT NULL CHECK (metric IN ('base_growth_pct', 'quality_multiplier', 'payout_ratio_pct')),
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  intensity numeric(4, 3) NOT NULL CHECK (intensity > 0 AND intensity <= 1),
  status text NOT NULL CHECK (status IN ('scheduled', 'completed', 'skipped_cooldown', 'skipped_out_of_range')),
  total_delta integer NOT NULL,
  ramp_ticks integer NOT NULL CHECK (ramp_ticks > 0),
  start_day integer NOT NULL,
  applied_ticks integer NOT NULL DEFAULT 0 CHECK (applied_ticks >= 0),
  applied_delta integer NOT NULL DEFAULT 0,
  UNIQUE (decision_id, position),
  UNIQUE (decision_id, metric)
);

INSERT INTO governance_decision_effects
  (decision_id, company_id, position, metric, direction, intensity, status, total_delta, ramp_ticks, start_day, applied_ticks, applied_delta)
SELECT id, company_id, 0, metric, direction, intensity, status, total_delta, ramp_ticks, start_day, applied_ticks, applied_delta
FROM governance_decisions;

CREATE INDEX governance_decision_effects_company_idx ON governance_decision_effects (company_id, start_day);
CREATE INDEX governance_decision_effects_status_idx ON governance_decision_effects (status) WHERE status = 'scheduled';

ALTER TABLE governance_decisions
  DROP COLUMN metric, DROP COLUMN direction, DROP COLUMN intensity, DROP COLUMN status,
  DROP COLUMN total_delta, DROP COLUMN ramp_ticks, DROP COLUMN start_day,
  DROP COLUMN applied_ticks, DROP COLUMN applied_delta;
