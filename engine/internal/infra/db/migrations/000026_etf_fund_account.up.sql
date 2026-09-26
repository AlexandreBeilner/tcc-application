-- Tarefa R.1 (backlog-motor-mercado-realista.md, Fase R): base de dados do ETF
-- no motor de negociação real. Cada ETF passa a ter uma CONTA DE FUNDO
-- (accounts, is_bot = true, sem linha em `users`, então fora de ranking e de
-- social pela mesma garantia de A.1) que detém a cesta como posições reais nos
-- constituintes e o caixa do fundo; o número de cotas passa a viver em
-- variable_income_assets.outstanding_shares (deixa de ser NULL).
--
-- fund_account_id é NULLABLE só para o banco que já tinha SINT11 antes desta
-- migration: o seed preenche (cmd/seed, ensureETFFund) e a partir daí todo ETF
-- criado pelo seed nasce com fundo. UNIQUE porque uma conta de fundo pertence
-- a exatamente um ETF.
--
-- expense_ratio_pct (% ao ano sobre o patrimônio, R.9) e
-- rebalance_frequency_days (R.7) têm default ilustrativo, mesma calibração
-- fina da tarefa 8.1. last_rebalance_day é o dia simulado do último
-- rebalanceamento (NULL = nunca rebalanceou). dividends_payable é o passivo de
-- dividendo a pagar do fundo (R.8): entra como `liabilities` do etf.NAV entre a
-- data-ex e o pagamento.
ALTER TABLE etf_details
  ADD COLUMN fund_account_id uuid UNIQUE REFERENCES accounts(user_id),
  ADD COLUMN expense_ratio_pct numeric(5, 2) NOT NULL DEFAULT 0.50 CHECK (expense_ratio_pct >= 0),
  ADD COLUMN rebalance_frequency_days integer NOT NULL DEFAULT 14 CHECK (rebalance_frequency_days > 0),
  ADD COLUMN last_rebalance_day integer,
  ADD COLUMN dividends_payable numeric(15, 2) NOT NULL DEFAULT 0 CHECK (dividends_payable >= 0);

-- Criação e resgate de cotas (R.2): um evento por constituinte que troca de
-- mãos e um pelas cotas, gravados antes de projetar posições e cotas (Event
-- Sourcing, CLAUDE.md).
ALTER TYPE market_event_type ADD VALUE 'etf_creation';
ALTER TYPE market_event_type ADD VALUE 'etf_redemption';
