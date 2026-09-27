-- Fase T.1 do backlog-motor-mercado-realista: rentabilidade sobre capital de
-- risco precisa de disinvestedProceeds (soma bruta de vendas + resgates de
-- renda fixa) simétrico a total_invested (migration 000001) e
-- total_dividends_received (idem) — hoje só current_balance é creditado na
-- venda/resgate (order_execution_repository.go, fixed_income_execution_repository.go),
-- sem nenhum acumulador equivalente. Mesmo padrão de ALTER TABLE das
-- migrations 000010/000011 (is_bot/is_active).
ALTER TABLE accounts ADD COLUMN total_disinvested numeric(15, 2) NOT NULL DEFAULT 0;
