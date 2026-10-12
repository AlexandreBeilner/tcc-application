import { describe, expect, it } from 'vitest'
import { createRedisAssetPriceSeriesCache } from './redisAssetPriceSeriesCache'
import type {
  AssetPriceSeries,
  AssetPriceSeriesCacheStore,
  AssetPriceSeriesReader,
} from '../../application/ports/assetPriceSeriesReader'

const sample: AssetPriceSeries = { a: [1, 2, 3] }

function setup(store: AssetPriceSeriesCacheStore) {
  const calls: number[] = []
  const next: AssetPriceSeriesReader = {
    async getRecentPrices(days) {
      calls.push(days)
      return sample
    },
  }
  return { calls, cached: createRedisAssetPriceSeriesCache(next, store, 60) }
}

function memoryStore() {
  const data = new Map<string, AssetPriceSeries>()
  const ttls: number[] = []
  const store: AssetPriceSeriesCacheStore = {
    async get(key) {
      return data.get(key) ?? null
    },
    async set(key, value, ttl) {
      data.set(key, value)
      ttls.push(ttl)
    },
  }
  return { store, data, ttls }
}

describe('createRedisAssetPriceSeriesCache', () => {
  it('cache frio chama o motor e popula; a segunda leitura não chama de novo', async () => {
    const { store, ttls } = memoryStore()
    const { cached, calls } = setup(store)

    await cached.getRecentPrices(30)
    const second = await cached.getRecentPrices(30)

    expect(second).toEqual(sample)
    expect(calls).toEqual([30])
    expect(ttls).toEqual([60])
  })

  it('chave por days: dias diferentes não compartilham cache', async () => {
    const { store } = memoryStore()
    const { cached, calls } = setup(store)

    await cached.getRecentPrices(30)
    await cached.getRecentPrices(7)

    expect(calls).toEqual([30, 7])
  })

  it('Redis fora do ar (get e set falham) não derruba a leitura', async () => {
    const { cached, calls } = setup({
      get: async () => {
        throw new Error('redis down')
      },
      set: async () => {
        throw new Error('redis down')
      },
    })

    await expect(cached.getRecentPrices(30)).resolves.toEqual(sample)
    expect(calls).toEqual([30])
  })
})
