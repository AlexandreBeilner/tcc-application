-- Achado de teste de ponta a ponta da Fase H (H.4, migration 000018): nada
-- impedia um ETF de referenciar a si mesmo como constituinte da própria
-- cesta (`etf_holdings.asset_id = etf_holdings.etf_asset_id`). Isso não é um
-- caso hipotético inofensivo — H.1 (NAV) somaria Quantity×Price do próprio
-- ETF como parte do patrimônio que sustenta o preço do próprio ETF,
-- circularidade sem significado financeiro (nenhum fundo real detém cotas
-- de si mesmo na própria cesta). Diferente do gap de normalização de peso
-- entre holding cosmético/real (achado 006 em
-- pontos-em-aberto-decisao-produto.md, que depende de decisão de produto),
-- este é mecânico — a própria FK já aponta pra `assets(id)`, então basta uma
-- CHECK barrando o caso degenerado, sem precisar `etf.NewDetails` saber o
-- próprio asset_id do ETF (ele não recebe esse parâmetro hoje).
ALTER TABLE etf_holdings
  ADD CONSTRAINT etf_holdings_no_self_reference_chk CHECK (asset_id IS NULL OR asset_id <> etf_asset_id);
