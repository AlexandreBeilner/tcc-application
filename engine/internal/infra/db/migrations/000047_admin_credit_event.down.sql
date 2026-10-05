-- Mesmo raciocínio de 000036_salary_payment_event.down.sql: Postgres não remove valor
-- de enum diretamente, então recria o tipo sem 'admin_credit' (mantendo
-- 'salary_payment') — falha de propósito (o cast rejeita) se algum crédito
-- administrativo já foi gravado, porque reverter implicaria apagar evento imutável
-- (Event Sourcing, CLAUDE.md).
ALTER TYPE market_event_type RENAME TO market_event_type_old;

CREATE TYPE market_event_type AS ENUM (
  'initial_deposit',
  'buy_order_executed',
  'sell_order_executed',
  'fixed_income_purchase',
  'fixed_income_redemption',
  'dividend_payment',
  'bot_initial_allocation',
  'bot_initial_cash',
  'etf_creation',
  'etf_redemption',
  'etf_share_transfer',
  'etf_dividend_payout',
  'etf_expense_payout',
  'salary_payment'
);

ALTER TABLE market_events
  ALTER COLUMN event_type TYPE market_event_type
  USING event_type::text::market_event_type;

DROP TYPE market_event_type_old;
