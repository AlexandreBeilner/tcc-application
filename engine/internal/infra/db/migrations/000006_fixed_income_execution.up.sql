-- Suporte a compra/resgate de renda fixa ponta a ponta (tarefa 3.13).

-- aplicação mínima não existia em nenhum documento de referência nem no
-- schema (spec/DER não fecham esses números). Coluna nova + backfill por
-- tipo de produto — dado ilustrativo de catálogo, mesmo precedente de
-- interest_rate/maturity_date (tarefa 3.9), sujeito à calibração da tarefa
-- 8.1. Backfill em duas etapas (nullable → UPDATE → NOT NULL) pra não
-- quebrar se a tabela já tiver linhas do seed da 3.9.
ALTER TABLE fixed_income_assets ADD COLUMN minimum_investment numeric(15, 2);

UPDATE fixed_income_assets fia
SET minimum_investment = CASE a.type
  WHEN 'tesouro_selic' THEN 30.00
  WHEN 'tesouro_prefixado' THEN 30.00
  WHEN 'tesouro_ipca' THEN 30.00
  WHEN 'cdb' THEN 100.00
  WHEN 'lci' THEN 500.00
  WHEN 'lca' THEN 500.00
  WHEN 'cri' THEN 1000.00
  WHEN 'cra' THEN 1000.00
END
FROM assets a
WHERE a.id = fia.asset_id;

ALTER TABLE fixed_income_assets ALTER COLUMN minimum_investment SET NOT NULL;

-- Posição de renda fixa agregada por (user_id, asset_id) — decisão
-- confirmada com o usuário (backlog 3.13): comprar o mesmo título mais de
-- uma vez, em taxas diferentes, resulta numa única linha na carteira com a
-- taxa contratada ajustada pela média ponderada pelo valor aportado (mesmo
-- comportamento do Tesouro Direto real). Por isso não reaproveita a tabela
-- `positions` (pensada pra preço médio de ação, sem conceito de taxa
-- contratada) — tabela própria, mesma forma de `positions`
-- (UNIQUE (user_id, asset_id), migration 000005) mas com average_rate a
-- mais e quantity fracionário (compra é por valor em R$, não por
-- quantidade inteira de títulos).
CREATE TABLE fixed_income_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES accounts(user_id),
  asset_id uuid NOT NULL REFERENCES fixed_income_assets(asset_id),
  quantity numeric(18, 6) NOT NULL,
  average_price numeric(15, 2) NOT NULL,
  average_rate numeric(7, 4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fixed_income_positions_user_asset_uq UNIQUE (user_id, asset_id)
);
