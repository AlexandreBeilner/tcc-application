-- Tarefa R.7 (backlog-motor-mercado-realista.md): índice teórico do ETF (pesos-alvo
-- constantes, sem atrito) e o desvio acumulado do NAV contra ele (tracking error).
-- Nulos nas linhas gravadas antes desta migration.
ALTER TABLE etf_nav_history
  ADD COLUMN index_value numeric(15, 4),
  ADD COLUMN tracking_error_pct numeric(9, 4);
