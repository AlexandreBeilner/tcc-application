-- Achado 025 (.claude/pontos-em-aberto-decisao-produto.md): catch-up de
-- salário atrasado (T.5) credita N meses de uma vez, todos com
-- simulated_day = hoje (o dia em que o job rodou, nunca o 5º dia útil real de
-- cada mês devido) e o mesmo valor (nível atual) — sem mais nada, o
-- calendário (T.6) não tem como distinguir "salário de junho" de "salário de
-- agosto" quando os dois chegam no mesmo dia. reference_month ('YYYY-MM')
-- registra a que mês-calendário real o crédito se refere, só preenchido em
-- salary_payment (todo outro tipo de evento continua NULL).
ALTER TABLE market_events ADD COLUMN reference_month char(7);
