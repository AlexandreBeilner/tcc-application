-- Tarefa MO.6.11 (backlog-monetizacao.md, Fase F2): declaração de dividendo pendente.
--
-- No dia do balanço, a empresa elegível não declara o dividendo: o motor guarda aqui o lucro do
-- pool e o dia do balanço, o backend abre a assembleia de destinação do lucro e a liberação
-- (decisão, sem decisão, painel ou prazo de segurança) vira o provento, com as datas contadas
-- a partir da liberação. Nada aqui move saldo: o provento sai pelo caminho de sempre
-- (dividend_events), então o Event Sourcing do dividendo não muda.
CREATE TABLE governance_pending_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  -- Ciclo de balanço (0-based) que originou a declaração: no máximo uma por empresa e ciclo.
  cycle_index integer NOT NULL CHECK (cycle_index >= 0),
  report_day integer NOT NULL,
  held_day integer NOT NULL,
  pool_net_income numeric(24, 4) NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released')),
  -- Assembleia cuja decisão vai liberar a declaração (ligada pelo backend ao registrar a decisão).
  decision_assembly_id uuid,
  -- Liberação pedida pelo backend (sem decisão) ou pelo painel; sai no próximo tick.
  release_requested boolean NOT NULL DEFAULT false,
  release_reason text CHECK (release_reason IN ('decision', 'no_decision', 'admin', 'expired')),
  released_day integer,
  release_ex_day integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, cycle_index)
);

CREATE INDEX governance_pending_declarations_held_idx ON governance_pending_declarations (company_id) WHERE status = 'held';
