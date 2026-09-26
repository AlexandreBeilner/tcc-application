-- Tarefa R.4 (backlog-motor-mercado-realista.md): transferência de cotas de ETF
-- em espécie do Participante Autorizado para o Market Maker que passa a cotar
-- o ETF. Mesma convenção de etf_creation/etf_redemption: quantidade COM SINAL,
-- igual ao delta da posição daquela conta. Não move caixa nem altera
-- outstanding_shares.
ALTER TYPE market_event_type ADD VALUE 'etf_share_transfer';
