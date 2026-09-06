// Agrupamento dos 11 valores do enum `asset_type` do motor
// (`.docs/engine/catalog.md`) pela classe que cada endpoint de compra
// real de fato negocia — usado pelo gate de desbloqueio (tarefa 7.0.1,
// achado da revisão da Semana 7) pra nunca aplicar o gate de uma classe
// num `asset_id` de outra classe (o motor já rejeita essa combinação com
// 400, o gate não deve mascarar esse erro com um 403 de "produto travado").
export const EQUITY_ASSET_TYPES = ['acao', 'etf', 'fii'] as const

export const FIXED_INCOME_ASSET_TYPES = [
  'tesouro_selic',
  'tesouro_prefixado',
  'tesouro_ipca',
  'cdb',
  'lci',
  'lca',
  'cri',
  'cra',
] as const
