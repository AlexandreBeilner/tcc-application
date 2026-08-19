-- Banco "market" — motor de simulação. Fonte da verdade financeira via
-- Event Sourcing (market_events). Combina o DER original do TCC (Figura 11)
-- com as extensões da spec seção 4. Ver .claude/der-original-tcc.md para as
-- divergências assumidas (ex: sandbox_assets como flag, sector como enum).

CREATE TYPE asset_type AS ENUM (
  'tesouro_selic', 'tesouro_prefixado', 'tesouro_ipca',
  'cdb', 'lci', 'lca', 'cri', 'cra',
  'acao', 'etf', 'fii'
);

CREATE TYPE issuer_type AS ENUM ('tesouro', 'banco', 'securitizadora');

CREATE TYPE order_type AS ENUM ('market', 'limit');
CREATE TYPE order_side AS ENUM ('buy', 'sell');
CREATE TYPE order_status AS ENUM ('pending', 'filled', 'partially_filled', 'cancelled');

-- Conjunto inicial — cresce nas semanas 2-4 conforme novas operações
-- (resgate de renda fixa, dividendos, efeitos de evento macro) entram.
CREATE TYPE market_event_type AS ENUM (
  'initial_deposit',
  'buy_order_executed',
  'sell_order_executed',
  'fixed_income_purchase',
  'fixed_income_redemption',
  'dividend_payment'
);

-- Lista fixa exigida pela spec 3.3.2, pra casar com o catálogo de templates
-- de evento macro.
CREATE TYPE company_sector AS ENUM (
  'Mineração', 'Agronegócio', 'Bancário/Financeiro', 'Varejo', 'Energia', 'Tecnologia'
);

CREATE TYPE fii_type AS ENUM ('tijolo', 'papel');

CREATE TYPE macro_direction AS ENUM ('positivo', 'negativo', 'misto');
CREATE TYPE macro_magnitude_band AS ENUM ('leve', 'moderado', 'severo');
CREATE TYPE macro_event_status AS ENUM ('pendente', 'aplicado');
CREATE TYPE macro_target_metric AS ENUM ('price', 'net_income', 'ebit', 'gross_debt', 'cash_equivalents');

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker varchar(10) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  type asset_type NOT NULL,
  risk_class varchar(20),
  -- Isola ativos fictícios do sandbox de aprendizado do catálogo do
  -- mercado ao vivo (spec seção 3.1) — flag em vez de tabela separada.
  is_sandbox boolean NOT NULL DEFAULT false
);

CREATE TABLE fixed_income_assets (
  asset_id uuid PRIMARY KEY REFERENCES assets(id),
  interest_rate numeric(5, 2),
  maturity_date timestamptz,
  issuer_type issuer_type NOT NULL,
  tax_exempt boolean NOT NULL DEFAULT false,
  credit_risk_rating varchar(10)
);

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  cnpj varchar(14) NOT NULL UNIQUE,
  sector company_sector NOT NULL,
  report_frequency_days int NOT NULL DEFAULT 14,
  next_report_date timestamptz
);

CREATE TABLE variable_income_assets (
  asset_id uuid PRIMARY KEY REFERENCES assets(id),
  -- Nullable: ETFs e FIIs são variable_income_assets sem empresa/classe de
  -- ação — só ações (type = 'acao') preenchem os dois campos.
  company_id uuid REFERENCES companies(id),
  share_class varchar(5),
  outstanding_shares bigint
);

CREATE TABLE company_fundamentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  period_date timestamptz NOT NULL,
  net_revenue numeric(15, 2),
  net_income numeric(15, 2),
  ebit numeric(15, 2),
  net_equity numeric(15, 2),
  gross_debt numeric(15, 2),
  cash_equivalents numeric(15, 2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- user_id referencia users.id do banco "gamification" — sem FK de verdade
-- entre bancos distintos no Postgres; validado na aplicação.
CREATE TABLE accounts (
  user_id uuid PRIMARY KEY,
  -- RNF06 / CLAUDE.md: capital inicial sempre R$ 10.000,00, não configurável.
  current_balance numeric(15, 2) NOT NULL DEFAULT 10000.00,
  total_invested numeric(15, 2) NOT NULL DEFAULT 0,
  total_dividends_received numeric(15, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES accounts(user_id),
  asset_id uuid NOT NULL REFERENCES assets(id),
  quantity int NOT NULL,
  average_price numeric(15, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  user_id uuid NOT NULL REFERENCES accounts(user_id),
  type order_type NOT NULL,
  side order_side NOT NULL,
  quantity int NOT NULL,
  price numeric(15, 2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fonte da verdade financeira (CLAUDE.md) — log append-only, nunca
-- atualizado nem apagado. accounts/positions são projeções dele.
CREATE TABLE market_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES accounts(user_id),
  asset_id uuid REFERENCES assets(id),
  event_type market_event_type NOT NULL,
  quantity int,
  unit_value numeric(15, 2),
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dividend_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES variable_income_assets(asset_id),
  value_per_share numeric(15, 2) NOT NULL,
  ex_date date NOT NULL,
  payment_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE etf_details (
  asset_id uuid PRIMARY KEY REFERENCES variable_income_assets(asset_id) ON DELETE CASCADE,
  benchmark_index varchar(100) NOT NULL,
  methodology_summary text
);

CREATE TABLE etf_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etf_asset_id uuid NOT NULL REFERENCES etf_details(asset_id) ON DELETE CASCADE,
  constituent_name varchar(100) NOT NULL,
  weight_pct numeric(5, 2) NOT NULL
);

CREATE TABLE fii_details (
  asset_id uuid PRIMARY KEY REFERENCES variable_income_assets(asset_id) ON DELETE CASCADE,
  fii_type fii_type NOT NULL,
  segment varchar(50),
  net_worth numeric(15, 2),
  vacancy_rate numeric(5, 2),
  indexador varchar(20),
  CONSTRAINT fii_type_fields_chk CHECK (
    (fii_type = 'tijolo' AND indexador IS NULL) OR
    (fii_type = 'papel' AND vacancy_rate IS NULL)
  )
);

-- created_by referencia users.id do banco "gamification" (admin que
-- disparou manualmente); nulo quando disparado pelo Temporizador.
CREATE TABLE macro_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key varchar(100),
  title varchar(150) NOT NULL,
  narrative text NOT NULL,
  direction macro_direction NOT NULL,
  magnitude_band macro_magnitude_band NOT NULL,
  affects_price boolean NOT NULL DEFAULT false,
  affects_fundamentals boolean NOT NULL DEFAULT false,
  status macro_event_status NOT NULL DEFAULT 'pendente',
  triggered_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE macro_event_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_event_id uuid NOT NULL REFERENCES macro_events(id) ON DELETE CASCADE,
  sector company_sector,
  risk_class varchar(20),
  asset_id uuid REFERENCES assets(id),
  affected_metric macro_target_metric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT macro_target_scope_chk CHECK (num_nonnulls(sector, risk_class, asset_id) = 1)
);
