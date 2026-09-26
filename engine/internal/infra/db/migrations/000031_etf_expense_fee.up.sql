-- Tarefa R.9 (backlog-motor-mercado-realista.md): taxa de administração do ETF. O fundo
-- acumula a taxa diariamente como passivo (fees_payable, reduz o NAV) e a quita do caixa
-- a cada ciclo de relatório; o pagamento é um evento sourced na conta do fundo
-- (quantidade 1, unit_value = valor pago).
ALTER TYPE market_event_type ADD VALUE 'etf_expense_payout';
ALTER TABLE etf_details
  ADD COLUMN fees_payable numeric(15, 4) NOT NULL DEFAULT 0 CHECK (fees_payable >= 0);
