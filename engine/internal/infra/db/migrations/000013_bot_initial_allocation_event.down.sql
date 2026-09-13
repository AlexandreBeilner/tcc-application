-- Postgres não suporta remover um valor de enum diretamente — recria o
-- tipo sem 'bot_initial_allocation' e migra a coluna. Falha de propósito se
-- alguma linha em market_events já usa esse valor (o cast abaixo rejeita) —
-- reverter esta migration depois que o seed já rodou implicaria apagar
-- evento imutável, o que o próprio Event Sourcing (CLAUDE.md) proíbe.
ALTER TYPE market_event_type RENAME TO market_event_type_old;

CREATE TYPE market_event_type AS ENUM (
  'initial_deposit',
  'buy_order_executed',
  'sell_order_executed',
  'fixed_income_purchase',
  'fixed_income_redemption',
  'dividend_payment'
);

ALTER TABLE market_events
  ALTER COLUMN event_type TYPE market_event_type
  USING event_type::text::market_event_type;

DROP TYPE market_event_type_old;
