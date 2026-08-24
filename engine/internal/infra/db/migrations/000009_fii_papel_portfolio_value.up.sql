-- Grandeza numérica pra FII papel (tarefa 4.10) — achado da tarefa 4.9:
-- dividend.FIIValuePerShare precisa de uma grandeza numérica como base do
-- cálculo (mesmo papel que net_worth cumpre pro perfil tijolo), mas o
-- catálogo nunca modelou uma pro perfil papel — sem ela, FII papel nunca
-- gera provento nem Dividend Yield, violando RF21/CLAUDE.md ("ambos os
-- perfis de FII" mostram Dividend Yield). portfolio_value é o valor
-- ilustrativo da carteira de recebíveis, mesmo tratamento "sujeito à
-- calibração da tarefa 8.1" de net_worth.
--
-- Exclusão mútua com net_worth reforçada no CHECK fii_type_fields_chk —
-- mesmo padrão já usado pra vacancy_rate/indexador — e replicada em
-- fii.NewDetails (regra de aplicação, não só de banco, mesma decisão da
-- tarefa 3.8).
ALTER TABLE fii_details
  ADD COLUMN portfolio_value numeric(15, 2);

ALTER TABLE fii_details
  DROP CONSTRAINT fii_type_fields_chk;

ALTER TABLE fii_details
  ADD CONSTRAINT fii_type_fields_chk CHECK (
    (fii_type = 'tijolo' AND indexador IS NULL AND portfolio_value IS NULL) OR
    (fii_type = 'papel' AND vacancy_rate IS NULL AND net_worth IS NULL)
  );
