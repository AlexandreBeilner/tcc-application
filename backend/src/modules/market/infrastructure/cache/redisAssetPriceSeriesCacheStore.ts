import type { Redis } from 'ioredis'
import type {
  AssetPriceSeries,
  AssetPriceSeriesCacheStore,
} from '../../application/ports/assetPriceSeriesReader'

export function createRedisAssetPriceSeriesCacheStore(client: Redis): AssetPriceSeriesCacheStore {
  return {
    async get(key: string): Promise<AssetPriceSeries | null> {
      const raw = await client.get(key)
      if (!raw) return null
      return JSON.parse(raw) as AssetPriceSeries
    },

    async set(key: string, value: AssetPriceSeries, ttlSeconds: number): Promise<void> {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    },
  }
}
