-- Fase A.4 do backlog-motor-mercado-realista: interruptor operacional do
-- bot, independente de `is_bot` (A.1, migration 000010) — `is_bot` é
-- identidade (essa conta é um bot, nunca deixa de ser), `is_active` é
-- controle operacional (esse bot específico está participando das rodadas
-- de negociação agora ou não, reversível a qualquer momento sem afetar
-- posição/caixa acumulados). Mesma tabela/mesma migration de tabela que
-- is_bot, por pedido explícito da tarefa. Default true: toda conta nova
-- (humana ou bot) nasce ativa; bot inativo é uma transição operacional
-- posterior (A.4/N.1), nunca o estado inicial.
ALTER TABLE accounts ADD COLUMN is_active boolean NOT NULL DEFAULT true;
