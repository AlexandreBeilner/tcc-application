-- Duração explícita do efeito de preço de evento macro (tarefa 4.1) —
-- decisão confirmada com o usuário em 2026-08-22 (nota da Semana 4 no
-- backlog): o efeito imediato de preço dura duration_days dias simulados,
-- não é um salto de um dia só. macro_events/macro_event_targets já
-- existem desde a migration 000001_init_market_schema, sem nenhuma linha
-- gravada ainda (nenhum código consumia essas tabelas até aqui) — colunas
-- novas podem ser NOT NULL direto, sem o backfill em duas etapas usado
-- pela 000006_fixed_income_execution (fixed_income_assets já tinha linhas
-- do seed da 3.9 quando ganhou minimum_investment).
ALTER TABLE macro_events
  ADD COLUMN triggered_on_day int NOT NULL,
  ADD COLUMN duration_days int NOT NULL,
  ADD COLUMN price_effect_pct numeric(6, 3),
  ADD COLUMN fundamentals_effect_pct numeric(6, 3),
  ADD COLUMN fundamentals_report_day int;
