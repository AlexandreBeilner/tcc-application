-- Tarefa E.1 do backlog-motor-mercado-realista (proposta seção 3):
-- macro_event_targets ganha direção/magnitude próprias, em vez de sempre
-- herdar a direção única de macro_events. Um evento "misto" passa a poder
-- declarar 2+ alvos com sinais diferentes (ex: setor Exportador positivo,
-- Importador negativo, no mesmo evento de câmbio) — evento "não-misto"
-- continua simples, nenhuma dessas três colunas precisa ser preenchida.
-- Nullable/sem backfill: macro_event_targets já não tinha nenhuma linha
-- gravada (nenhum código consumia a tabela antes da C.6/D.2 seedarem
-- bot_personality_scopes, tabela diferente) — mesmo raciocínio de colunas
-- novas direto sem migração em duas etapas já usado pela 000007.
ALTER TABLE macro_event_targets
  ADD COLUMN direction macro_direction,
  ADD COLUMN price_effect_pct numeric(6, 3),
  ADD COLUMN fundamentals_effect_pct numeric(6, 3),
  ADD CONSTRAINT macro_event_targets_direction_signed_chk CHECK (direction IS NULL OR direction IN ('positivo', 'negativo'));
