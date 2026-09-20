-- Histórico diário de Selic/IPCA simulados (tarefa M.1,
-- backlog-motor-mercado-realista) — mesmo padrão de asset_quotes: uma
-- linha por dia simulado, nunca atualizada depois de gravada (unicidade em
-- simulated_day, gravada por tick.go/tick_repository.go a cada SaveTick).
-- Diferente de market_calendar (linha singleton, só o dia/Selic
-- CORRENTE), esta tabela é o histórico completo pra série exibida no
-- frontend (tarefa M.4) — as duas coexistem sem mudança de contrato uma
-- da outra. ipca_monthly/ipca_accumulated_12m em decimal (ex: 0.004 =
-- 0,4%), mesma convenção de ipca.Config/selic.Config.InflationWeight.
CREATE TABLE market_indicator_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulated_day int NOT NULL,
  selic_rate numeric(6, 3) NOT NULL,
  ipca_monthly numeric(9, 6) NOT NULL,
  ipca_accumulated_12m numeric(9, 6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_indicator_history_day_uq UNIQUE (simulated_day)
);
