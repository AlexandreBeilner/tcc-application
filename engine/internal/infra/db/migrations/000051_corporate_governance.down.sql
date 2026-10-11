DROP TABLE IF EXISTS governance_decisions;
DROP TABLE IF EXISTS governance_snapshot_holdings;
DROP TABLE IF EXISTS governance_snapshot_runs;
ALTER TABLE market_events DROP COLUMN IF EXISTS reference_id;
-- O valor 'assembly_decision' do enum não é removido (Postgres não suporta) e a conta técnica
-- de governança (se criada) fica, porque market_events é append-only e pode já referenciá-la.
