ALTER TABLE fii_details
  DROP CONSTRAINT fii_type_fields_chk;

ALTER TABLE fii_details
  ADD CONSTRAINT fii_type_fields_chk CHECK (
    (fii_type = 'tijolo' AND indexador IS NULL) OR
    (fii_type = 'papel' AND vacancy_rate IS NULL)
  );

ALTER TABLE fii_details
  DROP COLUMN portfolio_value;
