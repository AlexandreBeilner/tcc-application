-- Postgres não remove valor de enum diretamente, então recria o tipo sem
-- 'etf_creation'/'etf_redemption' — falha de propósito (cast rejeita) se
-- alguma linha em market_events já usa um deles, porque reverter depois
-- disso implicaria apagar evento imutável (Event Sourcing, CLAUDE.md).
ALTER TABLE etf_details
  DROP COLUMN dividends_payable,
  DROP COLUMN last_rebalance_day,
  DROP COLUMN rebalance_frequency_days,
  DROP COLUMN expense_ratio_pct,
  DROP COLUMN fund_account_id;

ALTER TYPE market_event_type RENAME TO market_event_type_old;

CREATE TYPE market_event_type AS ENUM (
  'initial_deposit',
  'buy_order_executed',
  'sell_order_executed',
  'fixed_income_purchase',
  'fixed_income_redemption',
  'dividend_payment',
  'bot_initial_allocation',
  'bot_initial_cash'
);

ALTER TABLE market_events
  ALTER COLUMN event_type TYPE market_event_type
  USING event_type::text::market_event_type;

DROP TYPE market_event_type_old;
