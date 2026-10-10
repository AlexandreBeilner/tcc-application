-- Achado do review do PR #24 (Fase B do backlog-motor-mercado-realista):
-- AccountRepository.Create gravava o caixa inicial de um bot de liquidez
-- (account.NewBot) sob o mesmo 'initial_deposit' usado pro depósito humano
-- de RNF06 (sempre R$ 10.000,00, CLAUDE.md) — um valor fixo e conhecido que
-- qualquer leitura futura do extrato (RF05) poderia assumir como
-- verdadeiro pra todo evento desse tipo. Caixa de bot é um valor arbitrário
-- (bot.InitialCash, correlacionado ao papel), então precisa do próprio
-- tipo, mesmo raciocínio que já motivou 'bot_initial_allocation'
-- (migration 000013) pro lado da posição.
ALTER TYPE market_event_type ADD VALUE 'bot_initial_cash';
