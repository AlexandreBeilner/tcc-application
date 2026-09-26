-- Tarefa P.1 do backlog-motor-mercado-realista (proposta-cobertura-market-maker.md,
-- seções 3.1 e 3.2): cobertura de Market Maker como dado. Quem cota o quê
-- deixa de ser uma constante do seed mais o sorteio de um ativo por rodada e
-- passa a viver numa tabela, pra o catálogo poder crescer sem sobrecarregar
-- uma conta só.

-- Teto de ativos por Market Maker (padrão 10, decisão de 2026-09-23). Do bot,
-- não uma constante global, pro painel admin (Fase N) poder ajustar por bot.
ALTER TABLE bot_personalities ADD COLUMN max_covered_assets integer;

-- Backfill: o Market Maker único do seed atual ganha o teto padrão.
UPDATE bot_personalities SET max_covered_assets = 10 WHERE archetype = 'market_maker';

-- Espelha bot.NewPersonality: obrigatório e positivo pro Market Maker, nulo
-- pros demais arquétipos.
ALTER TABLE bot_personalities ADD CONSTRAINT bot_personalities_max_covered_assets_chk CHECK (
  (archetype = 'market_maker' AND max_covered_assets IS NOT NULL AND max_covered_assets > 0) OR
  (archetype != 'market_maker' AND max_covered_assets IS NULL)
);

-- A chave composta já comporta redundância (dois Market Makers no mesmo
-- ativo) sem mudar o modelo, mesmo que a v1 use um por ativo.
CREATE TABLE market_maker_coverage (
  asset_id uuid NOT NULL REFERENCES assets(id),
  mm_account_id uuid NOT NULL REFERENCES bot_personalities(account_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, mm_account_id)
);

-- Leitura por Market Maker (quantos e quais ativos cobre).
CREATE INDEX market_maker_coverage_mm_account_id_idx ON market_maker_coverage (mm_account_id);
