-- Mesmo raciocínio de 000013_bot_initial_allocation_event.down.sql:
-- Postgres não remove valor de enum diretamente, então recria o tipo sem
-- 'bot_initial_cash' — falha de propósito (cast rejeita) se alguma linha
-- em market_events já usa esse valor, porque reverter depois que o seed já
-- rodou implicaria apagar evento imutável (Event Sourcing, CLAUDE.md).
ALTER TYPE market_event_type RENAME TO market_event_type_old;

CREATE TYPE market_event_type AS ENUM (
  'initial_deposit',
  'buy_order_executed',
  'sell_order_executed',
  'fixed_income_purchase',
  'fixed_income_redemption',
  'dividend_payment',
  'bot_initial_allocation'
);

ALTER TABLE market_events
  ALTER COLUMN event_type TYPE market_event_type
  USING event_type::text::market_event_type;

DROP TYPE market_event_type_old;
