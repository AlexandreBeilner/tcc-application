-- Tarefa P.2 do backlog-motor-mercado-realista: backfill da cobertura de um
-- banco anterior à tabela market_maker_coverage (migration 000023). O Market
-- Maker único que o seed antigo criou já cota, de fato, todo ativo em que tem
-- posição: a cobertura só passa a constar na tabela. Não cria conta e não mexe
-- em saldo nem em posição. Banco novo (sem posições ainda) não é afetado, e
-- ON CONFLICT torna a migration inofensiva se a cobertura já existir.
INSERT INTO market_maker_coverage (asset_id, mm_account_id)
SELECT p.asset_id, p.user_id
FROM positions p
JOIN bot_personalities bp ON bp.account_id = p.user_id AND bp.archetype = 'market_maker'
JOIN assets a ON a.id = p.asset_id
WHERE a.is_sandbox = false AND a.type IN ('acao', 'fii')
ON CONFLICT (asset_id, mm_account_id) DO NOTHING;
