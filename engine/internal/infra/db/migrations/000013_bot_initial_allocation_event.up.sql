-- Fase B.2 do backlog-motor-mercado-realista: a distribuição inicial do
-- float entre bots (bot.InitialAllocation, tarefa B.1) precisa gravar um
-- evento imutável antes de projetar `positions` (CLAUDE.md, Event Sourcing).
-- Não reaproveita 'buy_order_executed' porque essa alocação não é uma
-- ordem executada contra uma contraparte real — é o float nascendo
-- distribuído nos bots no seed, sem contraparte nenhuma, análogo a uma
-- subscrição/IPO. Reusar o tipo de evento de compra confundiria qualquer
-- leitura futura do extrato (RF05) fazendo parecer que existiu uma ordem
-- casada que nunca aconteceu.
ALTER TYPE market_event_type ADD VALUE 'bot_initial_allocation';
