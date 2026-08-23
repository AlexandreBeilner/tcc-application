-- Estado do calendário simulado do Mercado Ao Vivo, avançado pelo
-- Temporizador (tarefa 3.11) — único e global (spec 3.3: "o Mercado Ao Vivo
-- é único e global"), por isso uma linha singleton em vez de uma tabela por
-- usuário. id fixo em 1 com CHECK garante que nunca existe mais de uma
-- linha (upsert via ON CONFLICT (id) no tick_repository.go).
CREATE TABLE market_calendar (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_day int NOT NULL DEFAULT 0,
  selic_rate numeric(6, 3) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cotação de fechamento por ativo de renda variável, por dia simulado
-- (tarefa 3.11) — gerada a cada tick via equity.NextPrice (GBM, 3.1) usando
-- a Selic simulada do dia (selic.NextCalendarRate, 2.2/3.3) como drift.
-- Nunca atualizada depois de gravada (um preço por dia por ativo); a
-- unicidade (asset_id, simulated_day) também serve de índice pra achar a
-- cotação mais recente de um ativo.
CREATE TABLE asset_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  simulated_day int NOT NULL,
  price numeric(15, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_quotes_asset_day_uq UNIQUE (asset_id, simulated_day)
);
