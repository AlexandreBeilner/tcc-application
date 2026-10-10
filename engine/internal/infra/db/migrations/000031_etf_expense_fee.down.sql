ALTER TABLE etf_details DROP COLUMN fees_payable;
-- Mesma técnica de 000030: recria o tipo sem 'etf_expense_payout'; falha de
-- propósito se algum evento já o usa (evento imutável, Event Sourcing).
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
  'etf_dividend_payout'
);
ALTER TABLE market_events ALTER COLUMN event_type TYPE market_event_type USING event_type::text::market_event_type;
DROP TYPE market_event_type_old;
