-- Tarefa N.6 (backlog-motor-mercado-realista.md): histórico de ticks e controle do
-- agendador em runtime.
--
-- tick_runs: uma linha por tick executado, agendado, de recuperação (catch-up) ou
-- manual (POST /admin/tick, avançar N dias). `simulated_day` é NULL quando o tick
-- falhou antes de saber o dia. `catch_up_discarded` guarda quantos ticks atrasados
-- o MaxCatchUp descartou naquela recuperação (antes só ia pro log).
CREATE TABLE tick_runs (
  id bigserial PRIMARY KEY,
  simulated_day int,
  trigger text NOT NULL CHECK (trigger IN ('scheduled', 'manual', 'catchup')),
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  error_message text,
  started_at timestamptz NOT NULL,
  duration_ms integer NOT NULL,
  catch_up_discarded integer NOT NULL DEFAULT 0,
  selic_rate double precision,
  is_copom_day boolean NOT NULL DEFAULT false,
  is_report_day boolean NOT NULL DEFAULT false,
  quotes_count integer NOT NULL DEFAULT 0,
  fundamentals_count integer NOT NULL DEFAULT 0,
  dividends_generated_count integer NOT NULL DEFAULT 0,
  dividends_paid_count integer NOT NULL DEFAULT 0,
  bot_fills_count integer NOT NULL DEFAULT 0,
  expired_orders_count integer NOT NULL DEFAULT 0,
  uncovered_assets_count integer NOT NULL DEFAULT 0,
  intraday_rounds_count integer NOT NULL DEFAULT 0
);

CREATE INDEX tick_runs_started_at_idx ON tick_runs (started_at DESC, id DESC);

-- scheduler_control: linha singleton (como market_calendar). `paused` impede só o
-- tick AGENDADO; o manual continua valendo. `resumed_at` marca quando a pausa
-- acabou: o agendador conta slots perdidos a partir dele, então o tempo pausado de
-- propósito não vira catch-up.
CREATE TABLE scheduler_control (
  id smallint PRIMARY KEY CHECK (id = 1),
  paused boolean NOT NULL DEFAULT false,
  resumed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO scheduler_control (id) VALUES (1);
