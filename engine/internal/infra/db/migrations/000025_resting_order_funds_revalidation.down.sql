ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_quantity_non_negative_chk;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_balance_non_negative_chk;
-- Um valor de enum não pode ser removido no Postgres: 'insufficient_funds' fica no tipo.
