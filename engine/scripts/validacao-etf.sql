-- Invariantes do motor de ETF (tarefa R.12). Rodar contra o banco `market` depois de N ticks:
--   psql -U tcc -d market -At -F ' | ' -f engine/scripts/validacao-etf.sql
-- Cada linha é "verificação | violações"; tudo deve ser 0.
SELECT 'saldos negativos', count(*) FROM accounts WHERE current_balance < 0;

-- Conciliação de saldo contra market_events (fonte da verdade, Event Sourcing): o saldo de cada conta é a soma
-- dos eventos que mexem em caixa. Criação, resgate e transferência de cota não movem caixa (só posição).
SELECT 'conciliacao de saldo', count(*) FROM accounts a LEFT JOIN (
  SELECT user_id, sum(CASE event_type
      WHEN 'initial_deposit' THEN unit_value
      WHEN 'bot_initial_cash' THEN unit_value
      WHEN 'buy_order_executed' THEN -quantity * unit_value
      WHEN 'sell_order_executed' THEN quantity * unit_value
      WHEN 'dividend_payment' THEN quantity * unit_value
      WHEN 'etf_dividend_payout' THEN -quantity * unit_value
      WHEN 'etf_expense_payout' THEN -unit_value
      ELSE 0 END) AS bal
  FROM market_events GROUP BY user_id) ev USING (user_id)
WHERE abs(a.current_balance - coalesce(ev.bal, 0)) > 0.02;

-- Conciliação de posição: quantidade de cada posição contra os eventos com sinal.
SELECT 'conciliacao de posicao', count(*) FROM (
  SELECT coalesce(p.user_id, e.user_id) AS user_id, coalesce(p.asset_id, e.asset_id) AS asset_id,
         coalesce(p.quantity, 0) AS pos, coalesce(e.qty, 0) AS ev
  FROM positions p FULL JOIN (
    SELECT user_id, asset_id, sum(CASE event_type
        WHEN 'buy_order_executed' THEN quantity
        WHEN 'sell_order_executed' THEN -quantity
        WHEN 'bot_initial_allocation' THEN quantity
        WHEN 'etf_creation' THEN quantity
        WHEN 'etf_redemption' THEN quantity
        WHEN 'etf_share_transfer' THEN quantity
        ELSE 0 END) AS qty
    FROM market_events WHERE asset_id IS NOT NULL GROUP BY user_id, asset_id) e
    ON e.user_id = p.user_id AND e.asset_id = p.asset_id) t
WHERE pos <> ev;

-- Conservação do float: as posições de cada ação, FII e ETF somam exatamente as cotas emitidas.
SELECT 'float ou cotas diferentes das posicoes', count(*) FROM variable_income_assets via
  JOIN assets a ON a.id = via.asset_id
  LEFT JOIN (SELECT asset_id, sum(quantity) AS q FROM positions GROUP BY asset_id) p ON p.asset_id = via.asset_id
WHERE a.type IN ('acao', 'fii', 'etf') AND NOT a.is_sandbox AND via.outstanding_shares IS NOT NULL
  AND coalesce(p.q, 0) <> via.outstanding_shares;

-- Proventos do ETF: o que o fundo pagou aos cotistas (etf_dividend_payout) é o que os cotistas receberam
-- (dividend_payment nos ativos ETF), sem criar nem destruir dinheiro.
SELECT 'provento de ETF pago diferente do recebido', CASE WHEN abs(
  (SELECT coalesce(sum(quantity * unit_value), 0) FROM market_events WHERE event_type = 'etf_dividend_payout') -
  (SELECT coalesce(sum(e.quantity * e.unit_value), 0) FROM market_events e JOIN assets a ON a.id = e.asset_id
    WHERE e.event_type = 'dividend_payment' AND a.type = 'etf')) > 0.02 THEN 1 ELSE 0 END;

SELECT 'passivo de fundo negativo', count(*) FROM etf_details WHERE dividends_payable < 0 OR fees_payable < 0;
