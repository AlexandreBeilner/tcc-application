-- Suporte a execução de ordens ponta a ponta (tarefa 3.12).

-- Sem filled_quantity não dá pra reconstruir fielmente (via replay) quanto
-- de uma ordem limitada pendurada já foi executado em rodadas anteriores —
-- orderexecution.Execute precisa da quantidade *restante*, não da original.
-- status já sinaliza pending/partially_filled/filled/cancelled, mas não diz
-- "quanto".
ALTER TABLE order_book ADD COLUMN filled_quantity int NOT NULL DEFAULT 0;

-- positions não tinha nenhuma restrição de unicidade por (user_id,
-- asset_id) — sem ela, cada execução criaria uma linha nova em vez de
-- consolidar a posição existente do usuário nesse ativo (o "position" que
-- dá nome à tabela).
ALTER TABLE positions ADD CONSTRAINT positions_user_asset_uq UNIQUE (user_id, asset_id);
