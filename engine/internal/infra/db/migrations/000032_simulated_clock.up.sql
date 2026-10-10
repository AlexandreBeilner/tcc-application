-- Tarefa S.1 (backlog-motor-mercado-realista.md, achado 022): o dia simulado
-- (market_calendar.current_day) vira a única fonte de tempo das regras de negócio. Datas que
-- antes vinham do relógio de parede passam a ser datas simuladas (simcalendar: dia 0 =
-- 2026-01-05, uma segunda-feira, dia simulado = dia de calendário).
--
-- Backfill dos dados existentes: o tempo real decorrido desde cada registro vira dias
-- simulados anteriores ao dia corrente (1 dia real = 1 dia simulado até aqui), preservando
-- a ordem e os prazos relativos.

-- Dia simulado da primeira compra (sandbox: dia do roteiro; renda fixa: prazo do IR e
-- janela de rendimento).
ALTER TABLE positions ADD COLUMN created_day int NOT NULL DEFAULT 0;
ALTER TABLE fixed_income_positions ADD COLUMN created_day int NOT NULL DEFAULT 0;

UPDATE positions SET created_day = GREATEST(0,
  COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0)
  - floor(extract(epoch FROM (now() - created_at)) / 86400)::int);
UPDATE fixed_income_positions SET created_day = GREATEST(0,
  COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0)
  - floor(extract(epoch FROM (now() - created_at)) / 86400)::int);

-- Vencimento: data simulada com o mesmo prazo restante que tinha em tempo real.
UPDATE fixed_income_assets SET maturity_date = timestamptz '2026-01-05 00:00:00+00'
  + make_interval(days => COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0)
    + floor(extract(epoch FROM (maturity_date - now())) / 86400)::int)
WHERE maturity_date IS NOT NULL;

-- Proventos: as datas passam a derivar do dia simulado de pagamento (que já existia).
-- DefaultPaymentLagDays = 5 (ex_date = payment_date - 5 dias).
UPDATE dividend_events SET
  payment_date = timestamptz '2026-01-05 00:00:00+00' + make_interval(days => payment_day),
  ex_date = timestamptz '2026-01-05 00:00:00+00' + make_interval(days => payment_day - 5);

-- Fundamentos: period_date passa a ser data simulada (mantém a ordem por created_at).
UPDATE company_fundamentals SET period_date = timestamptz '2026-01-05 00:00:00+00'
  + make_interval(days => GREATEST(0,
      COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0)
      - floor(extract(epoch FROM (now() - created_at)) / 86400)::int));
