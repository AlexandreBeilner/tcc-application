-- Tarefa S.2 (backlog-motor-mercado-realista.md): tempos do mundo real em dias de calendário
-- simulado. Ciclo de relatório e rebalanceamento de ETF passam de 14 para 91 dias (um
-- trimestre); o Copom (45 dias) e o pagamento mensal de FII (30) são constantes de código.
ALTER TABLE companies ALTER COLUMN report_frequency_days SET DEFAULT 91;
UPDATE companies SET report_frequency_days = 91 WHERE report_frequency_days = 14;
ALTER TABLE etf_details ALTER COLUMN rebalance_frequency_days SET DEFAULT 91;
UPDATE etf_details SET rebalance_frequency_days = 91 WHERE rebalance_frequency_days = 14;
