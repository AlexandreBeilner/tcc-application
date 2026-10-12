-- Tarefa MO.6.2 (backlog-monetizacao.md, Fase F): lado do motor da Assembleia de Acionistas.
--
-- 1) Decisão da assembleia como evento imutável (Event Sourcing, CLAUDE.md): tipo
--    'assembly_decision' em market_events, gravado ANTES de qualquer efeito nos fundamentos.
--    O evento pertence a uma conta técnica de governança (is_bot, sem linha em `users`, fora
--    de ranking e de social, inativa; mesma ideia da conta de fundo do ETF, 000026), porque
--    market_events.user_id é obrigatório. A conta NÃO é criada aqui: nasce na primeira decisão
--    (GovernanceRepository.RecordDecision), então um motor que nunca usa assembleia não ganha
--    uma conta a mais em nenhuma contagem.
--    `reference_id` guarda o id da assembleia (idempotência e auditoria); `quantity` guarda a
--    mudança total decidida, em centésimos, com sinal.
ALTER TYPE market_event_type ADD VALUE IF NOT EXISTS 'assembly_decision';
ALTER TABLE market_events ADD COLUMN IF NOT EXISTS reference_id uuid;

-- 2) Snapshot de posições na data de corte: uma execução por assembleia (a linha existe mesmo
--    que ninguém tenha ações, então repetir a chamada devolve a mesma foto) e uma linha por
--    usuário com posição. Só contas de usuário (is_bot fora), ações somadas entre classes.
CREATE TABLE governance_snapshot_runs (
  assembly_id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  taken_at timestamptz NOT NULL DEFAULT now(),
  simulated_day integer NOT NULL
);

CREATE TABLE governance_snapshot_holdings (
  assembly_id uuid NOT NULL REFERENCES governance_snapshot_runs(assembly_id),
  user_id uuid NOT NULL,
  quantity bigint NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (assembly_id, user_id)
);

-- 3) Decisão e andamento da rampa. Única por assembleia (idempotência). applied_ticks e
--    applied_delta andam junto da mudança na empresa, na mesma transação.
CREATE TABLE governance_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id uuid NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES companies(id),
  option_key text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('base_growth_pct', 'quality_multiplier')),
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  intensity numeric(4, 3) NOT NULL CHECK (intensity > 0 AND intensity <= 1),
  status text NOT NULL CHECK (status IN ('scheduled', 'completed', 'skipped_cooldown', 'skipped_out_of_range')),
  total_delta integer NOT NULL,
  ramp_ticks integer NOT NULL CHECK (ramp_ticks > 0),
  start_day integer NOT NULL,
  applied_ticks integer NOT NULL DEFAULT 0 CHECK (applied_ticks >= 0),
  applied_delta integer NOT NULL DEFAULT 0,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX governance_decisions_company_idx ON governance_decisions (company_id, start_day);
CREATE INDEX governance_decisions_status_idx ON governance_decisions (status) WHERE status = 'scheduled';
