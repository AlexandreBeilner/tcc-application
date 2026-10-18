-- Ponto 063: o Modo Aprendizado (ativos `is_sandbox`) deixa de mexer no caixa da conta. Daqui em
-- diante a ordem e a renda fixa de Sandbox gravam o evento e a posição, mas não tocam em
-- `current_balance`, `total_invested` nem `total_disinvested`. Esta migration corrige o passado:
-- devolve às contas existentes o que o Sandbox já tinha debitado (e retira o que já tinha creditado),
-- para o saldo voltar a bater com a reconstrução pelos eventos que ignora Sandbox (integridade e
-- ranking). Os eventos são append-only e ficam como estão.
WITH sandbox_flows AS (
  SELECT e.user_id,
         COALESCE(SUM(CASE
           WHEN e.event_type = 'buy_order_executed' THEN e.quantity * e.unit_value
           WHEN e.event_type = 'fixed_income_purchase' THEN e.unit_value
         END), 0) AS bought,
         COALESCE(SUM(CASE
           WHEN e.event_type = 'sell_order_executed' THEN e.quantity * e.unit_value
           WHEN e.event_type = 'fixed_income_redemption' THEN e.unit_value
         END), 0) AS sold
  FROM market_events e
  JOIN assets a ON a.id = e.asset_id
  WHERE a.is_sandbox
    AND e.event_type IN ('buy_order_executed', 'sell_order_executed', 'fixed_income_purchase', 'fixed_income_redemption')
  GROUP BY e.user_id
)
UPDATE accounts
SET current_balance = GREATEST(accounts.current_balance + f.bought - f.sold, 0),
    total_invested = GREATEST(accounts.total_invested - f.bought, 0),
    total_disinvested = GREATEST(accounts.total_disinvested - f.sold, 0),
    updated_at = now()
FROM sandbox_flows f
WHERE accounts.user_id = f.user_id;
