// Séries curtas de preço de todos os ativos cotados numa chamada só (MO.9.5,
// sparkline das listas do Mercado). Espelha `GET /assets/quotes` do motor
// (`.docs/engine/catalog.md`): `series` indexado por asset_id, preços em
// ordem cronológica; ativo sem cotação não aparece. Porta própria (não
// estendida de CatalogReader) porque o consumidor precisa do cache em volta
// sem decorar o resto do catálogo.
export type AssetPriceSeries = Record<string, number[]>

export interface AssetPriceSeriesReader {
  getRecentPrices(days: number): Promise<AssetPriceSeries>
}

// Cache de leitura da série (mesmo padrão de IndicatorHistoryCacheStore):
// TTL é de quem escreve.
export interface AssetPriceSeriesCacheStore {
  get(key: string): Promise<AssetPriceSeries | null>
  set(key: string, value: AssetPriceSeries, ttlSeconds: number): Promise<void>
}
