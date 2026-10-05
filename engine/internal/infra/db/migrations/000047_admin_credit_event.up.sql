-- Tarefa N.17 (backlog-motor-mercado-realista.md, Fase N): crédito de caixa feito
-- pelo administrador na conta de um usuário. Tipo de evento próprio no Event
-- Sourcing (CLAUDE.md), distinto de 'salary_payment' (folha mensal) e de
-- 'initial_deposit' (RNF06): o extrato rotula cada um e nenhum entra no cálculo de
-- rentabilidade, que só olha capital que já foi de risco.
ALTER TYPE market_event_type ADD VALUE 'admin_credit';
