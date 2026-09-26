-- Tarefa R.3 (backlog-motor-mercado-realista.md): histórico diário do valor
-- patrimonial (NAV) de cada ETF, do preço de fechamento e do ágio/deságio
-- entre os dois. Uma linha por ETF por dia simulado, gravada no SaveTick
-- (atômica com o resto do tick). O tracking error (R.7) entra numa migration
-- própria quando existir.
CREATE TABLE etf_nav_history (
  etf_asset_id uuid NOT NULL REFERENCES etf_details(asset_id) ON DELETE CASCADE,
  simulated_day integer NOT NULL,
  nav numeric(15, 4) NOT NULL,
  close_price numeric(15, 2) NOT NULL,
  premium_pct numeric(9, 4) NOT NULL,
  PRIMARY KEY (etf_asset_id, simulated_day)
);
