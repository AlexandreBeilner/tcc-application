// Preço de um ativo de renda variável num instante passado — via
// `GET /assets/:id/quotes` (4.6). Ver o adapter concreto pra nota sobre a
// aproximação usada (motor só expõe `simulated_day`, não data real).
export interface AssetPriceHistoryReader {
  priceAsOf(assetId: string, cutoff: Date): Promise<number>
}
