import type {
  AssetPriceSeries,
  AssetPriceSeriesCacheStore,
  AssetPriceSeriesReader,
} from '../../application/ports/assetPriceSeriesReader'

// A série só muda quando o Temporizador roda (no máximo 1x por dia real,
// mais o gatilho manual do admin), então 5 min é folgado e protege o motor
// de uma consulta por abertura de lista (mesmo TTL do histórico de
// indicadores).
const DEFAULT_TTL_SECONDS = 5 * 60

function cacheKey(days: number): string {
  return `market:price-series:${days}`
}

// Decora AssetPriceSeriesReader com cache de leitura. A chave é só `days`: a
// série é a mesma pra qualquer usuário. Redis fora do ar nunca derruba a
// leitura (miss/no-op), a fonte da verdade continua sendo o motor.
export function createRedisAssetPriceSeriesCache(
  next: AssetPriceSeriesReader,
  store: AssetPriceSeriesCacheStore,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): AssetPriceSeriesReader {
  return {
    async getRecentPrices(days: number): Promise<AssetPriceSeries> {
      const key = cacheKey(days)
      const cached = await store.get(key).catch(() => null)
      if (cached) return cached

      const series = await next.getRecentPrices(days)
      await store.set(key, series, ttlSeconds).catch(() => undefined)
      return series
    },
  }
}
