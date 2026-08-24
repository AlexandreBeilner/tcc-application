-- Geração/pagamento de dividendos (tarefa 4.9) — dividend_events já existe
-- desde a migration 000001_init_market_schema, sem nenhuma linha gravada
-- ainda (nenhum código consumia a tabela até aqui), então as colunas novas
-- podem ser NOT NULL direto, mesmo precedente da 000007.
--
-- payment_day é o dia simulado (não a data de calendário real de ex_date/
-- payment_date, que continuam preenchidas com o relógio real — mesma
-- decisão de period_date em company_fundamentals, tarefa 3.14) em que o
-- Temporizador credita os usuários — precisa ser um dia simulado, não uma
-- data real, porque é o gate que decide "chegou o dia de pagar" num tick
-- futuro (mesmo padrão de macro_events.fundamentals_report_day), e o
-- Temporizador precisa disso determinístico e alcançável em poucos ticks
-- de teste, não dependente de dias de calendário real passarem de verdade.
--
-- paid marca um dividend_events já processado — mesmo padrão defensivo de
-- macro_events.status = 'aplicado', evita reprocessar (creditar de novo)
-- num tick futuro.
ALTER TABLE dividend_events
  ADD COLUMN payment_day int NOT NULL,
  ADD COLUMN paid boolean NOT NULL DEFAULT false;

CREATE INDEX dividend_events_pending_payment_idx ON dividend_events (payment_day) WHERE paid = false;

-- Snapshot de elegibilidade capturado no momento da geração (a "data ex")
-- — a posição de cada usuário no ativo pagador nesse instante, pra
-- garantir que só quem já tinha posição na data ex recebe o pagamento no
-- dia de pagamento, mesmo que a posição mude entre os dois dias (critério
-- de aceite da tarefa 4.9). positions não guarda histórico, só o estado
-- atual — por isso o snapshot precisa de uma tabela própria, gravada
-- atomicamente com o dividend_events que ela referencia.
CREATE TABLE dividend_event_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dividend_event_id uuid NOT NULL REFERENCES dividend_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES accounts(user_id),
  quantity int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dividend_event_recipients_event_idx ON dividend_event_recipients (dividend_event_id);
