-- Tarefa RC.6.7 (backlog-revisao-trilhas-e-ux.md, pacote P8): base de dados do escalonamento de
-- balanços e proventos por ativo (pacote paymentschedule, RC.6.6; parâmetros em
-- .claude/calibracao-calendario-proventos.md). Migration aditiva: todo default reproduz o
-- comportamento legado (relógio único de 91 dias, ex no dia da geração, pagamento em 5 dias,
-- FII a cada 30 dias), então nada muda até o motor passar a ler estas colunas (RC.6.8 em diante).
-- market_events (append-only) e os dividend_events já pagos não são tocados.

-- Empresas: atraso do balanço em DIAS ÚTEIS depois do fim do trimestre (0 = legado, mesmo dia
-- para todas), periodicidade do provento e defasagens da data-com (a partir do balanço) e do
-- pagamento (a partir da data-ex), em dias úteis. schedule_assigned marca a linha que já recebeu
-- a agenda derivada do ticker (paymentschedule.DefaultsFor): o seed só atribui a quem ainda não
-- recebeu, sem sobrescrever o que um admin editar.
ALTER TABLE companies
  ADD COLUMN report_offset_days int NOT NULL DEFAULT 0 CHECK (report_offset_days >= 0 AND report_offset_days < 32),
  ADD COLUMN dividend_policy text NOT NULL DEFAULT 'quarterly'
    CHECK (dividend_policy IN ('quarterly', 'semiannual', 'annual')),
  ADD COLUMN com_lag_days int NOT NULL DEFAULT 0 CHECK (com_lag_days >= 0 AND com_lag_days <= 10),
  ADD COLUMN payment_lag_days int NOT NULL DEFAULT 5 CHECK (payment_lag_days >= 0 AND payment_lag_days <= 40),
  ADD COLUMN schedule_assigned boolean NOT NULL DEFAULT false;

-- FIIs: dia útil do mês seguinte em que o fundo paga (5 a 15 na calibração, 1 a 20 aceito).
ALTER TABLE fii_details
  ADD COLUMN payout_business_day int NOT NULL DEFAULT 10 CHECK (payout_business_day BETWEEN 1 AND 20),
  ADD COLUMN schedule_assigned boolean NOT NULL DEFAULT false;

-- Proventos: dia da declaração, dia da data-ex (dias simulados) e se o snapshot de quem tem
-- direito já foi tirado. Linhas antigas: declaração e ex no mesmo dia (a geração legada) e
-- snapshot já tirado (foi na geração).
ALTER TABLE dividend_events
  ADD COLUMN declared_day int,
  ADD COLUMN ex_day int,
  ADD COLUMN recipients_snapshotted boolean NOT NULL DEFAULT true;
UPDATE dividend_events SET ex_day = (ex_date::date - DATE '2026-01-05'), declared_day = (ex_date::date - DATE '2026-01-05');
ALTER TABLE dividend_events ALTER COLUMN declared_day SET NOT NULL, ALTER COLUMN ex_day SET NOT NULL;

-- Eventos esperando o snapshot na data-ex (RC.6.11): o índice só cobre os pendentes.
CREATE INDEX dividend_events_pending_snapshot_idx ON dividend_events (ex_day) WHERE recipients_snapshotted = false;

-- Dia de corte: até ele (newDay <= schedule_cutover_day) vale o relógio legado; depois, a agenda
-- escalonada. Nasce no dia simulado corrente do deploy, então o passado nunca é reescrito; num
-- banco novo (current_day 0) a agenda escalonada vale desde o começo.
ALTER TABLE market_calendar ADD COLUMN schedule_cutover_day int NOT NULL DEFAULT 0;
UPDATE market_calendar SET schedule_cutover_day = current_day;
