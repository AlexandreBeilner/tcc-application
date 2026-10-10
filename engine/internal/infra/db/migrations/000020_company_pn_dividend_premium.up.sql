-- Tarefa J.2 do backlog-motor-mercado-realista: dividend.EquityValuePerShare
-- deixa de assumir uma única classe de ação — a vantagem legal mínima de
-- dividendo da PN (Lei 6.404/76, art. 17, piso de 10%, reforma da Lei
-- 10.303/2001) passa a ser configurável por empresa, não um número fixo no
-- código. Default 10 reflete o piso legal mais comum na prática (proposta
-- 2.8, item 2) — empresa só-ON nunca lê esta coluna (sem ativo PN
-- vinculado, dividend.EquityValuePerShare recebe pnShares = 0).
ALTER TABLE companies ADD COLUMN pn_dividend_premium_pct numeric(5, 2) NOT NULL DEFAULT 10;
