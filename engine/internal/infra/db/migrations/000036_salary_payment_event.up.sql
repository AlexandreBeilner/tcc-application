-- Tarefa T.2 (backlog-motor-mercado-realista.md, Fase T): salário mensal
-- simulado, creditado como caixa livre na conta do usuário — nunca capital
-- de risco (T.1). Novo tipo de evento pra registrar esse crédito no
-- Event Sourcing (CLAUDE.md), distinto de 'initial_deposit' (RNF06, valor
-- fixo de R$ 10.000,00) e de 'dividend_payment' (proveniente de posição).
ALTER TYPE market_event_type ADD VALUE 'salary_payment';
