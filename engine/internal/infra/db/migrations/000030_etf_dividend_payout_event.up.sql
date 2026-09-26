-- Tarefa R.8 (backlog-motor-mercado-realista.md): o fundo de ETF distribui aos
-- cotistas o caixa de dividendos que recebeu dos constituintes. O pagamento debita o
-- caixa do fundo: evento sourced na conta do fundo, quantidade = cotas que recebem,
-- unit_value = valor por cota (o débito é quantidade x unit_value).
ALTER TYPE market_event_type ADD VALUE 'etf_dividend_payout';
