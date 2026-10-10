-- Correção do achado 005 (pontos-em-aberto-decisao-produto.md), partes A e
-- B: ciclo de vida de ordem (expiração por dia simulado obsoleto) + teto de
-- tamanho de ordem por volume negociado real.

-- Parte A.1: sem esta coluna não dá pra saber em que dia simulado uma
-- ordem nasceu, então ExpireStaleOrders (order_execution_repository.go)
-- não tem como distinguir uma ordem de hoje de uma ordem de semanas atrás —
-- é isso que hoje permite order_book crescer sem limite (achado 005
-- original: ordens gigantes de bot, nunca preenchíveis, ficam penduradas
-- pra sempre). DEFAULT 0 sem backfill real necessário (dado de dev/
-- simulação, não produção) — linhas antigas assumem dia 0, que é
-- exatamente o comportamento correto: elas devem expirar no próximo tick.
ALTER TABLE order_book ADD COLUMN simulated_day integer NOT NULL DEFAULT 0;

-- Parte B.1: soma de tudo que runIntradayRounds preencheu pra um ativo num
-- dia simulado (tick_repository.go, SaveTick) — insumo de
-- RecentTradedVolume, que alimenta o teto de tamanho de ordem por volume
-- médio recente (decisionInputFor, rounds.go), substituindo "100% do
-- float" como único teto. 0 pra ativo que não negociou no dia (ou que ainda
-- está no caminho de GBM, ex: ETF) — mas NULLABLE e SEM DEFAULT de
-- propósito (achado do teste de ponta a ponta desta correção, ambiente com
-- dados reais pré-existentes): um DEFAULT 0 faria todo dia simulado
-- anterior a esta migration virar "0 negociado" pra sempre, e
-- RecentTradedVolume (com histórico >= 1 dia, ainda que todo zero)
-- imediatamente calcularia um teto de volume zero pra qualquer ativo já
-- em produção — travando o lado de compra de todo bot permanentemente
-- (nunca mais gera volume real, então nunca sai do zero). NULL nas linhas
-- antigas é o sinal correto de "não sei, ainda não rastreava volume nesse
-- dia" — RecentTradedVolume filtra NULL, então esses dias contam como
-- "sem histórico" (cai pro float sozinho, comportamento já esperado pra
-- ativo novo) até dias novos, pós-migration, acumularem histórico real.
ALTER TABLE asset_quotes ADD COLUMN total_quantity integer;
