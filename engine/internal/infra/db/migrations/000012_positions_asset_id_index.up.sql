-- Tarefa A.3 (backlog-motor-mercado-realista) introduziu floatCeiling, que
-- soma positions.quantity filtrando por asset_id (e excluindo o usuário da
-- ordem recebida) a cada ordem processada num ativo com outstanding_shares
-- configurado. A única constraint existente em positions é
-- positions_user_asset_uq UNIQUE (user_id, asset_id) — user_id como coluna
-- líder não serve esse filtro por asset_id sozinho, forçando varredura
-- completa conforme positions cresce (mais bots/usuários, Fase B/C).
CREATE INDEX positions_asset_id_idx ON positions (asset_id);
