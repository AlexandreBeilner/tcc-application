-- As datas simuladas não voltam pro relógio de parede (backfill sem inverso exato); só as
-- colunas novas são removidas.
ALTER TABLE positions DROP COLUMN created_day;
ALTER TABLE fixed_income_positions DROP COLUMN created_day;
