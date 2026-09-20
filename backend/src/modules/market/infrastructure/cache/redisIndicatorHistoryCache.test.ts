import { describe, expect, it } from 'vitest'
import { createRedisIndicatorHistoryCache } from './redisIndicatorHistoryCache'
import { FakeIndicatorHistoryCacheStore } from '../../test/fakes/fakeIndicatorHistoryCacheStore'
import type {
  IndicatorHistoryEntry,
  IndicatorHistoryReader,
} from '../../application/ports/indicatorHistoryReader'

class SpyIndicatorHistoryReader implements IndicatorHistoryReader {
  calls: Array<number | undefined> = []
  constructor(private readonly history: IndicatorHistoryEntry[]) {}

  async getIndicatorHistory(days?: number): Promise<IndicatorHistoryEntry[]> {
    this.calls.push(days)
    return this.history
  }
}

const sampleHistory: IndicatorHistoryEntry[] = [
  { simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.0037, ipca_accumulated_12m: 0.045 },
]

describe('createRedisIndicatorHistoryCache', () => {
  it('cache frio: chama o reader real e popula o cache', async () => {
    const next = new SpyIndicatorHistoryReader(sampleHistory)
    const store = new FakeIndicatorHistoryCacheStore()
    const cached = createRedisIndicatorHistoryCache(next, store)

    const result = await cached.getIndicatorHistory(30)

    expect(result).toEqual(sampleHistory)
    expect(next.calls).toEqual([30])
    expect(store.setCalls).toBe(1)
  })

  it('segunda leitura do mesmo days não chama o reader real de novo (cache quente)', async () => {
    const next = new SpyIndicatorHistoryReader(sampleHistory)
    const store = new FakeIndicatorHistoryCacheStore()
    const cached = createRedisIndicatorHistoryCache(next, store)

    await cached.getIndicatorHistory(30)
    const second = await cached.getIndicatorHistory(30)

    expect(second).toEqual(sampleHistory)
    expect(next.calls).toEqual([30])
  })

  it('days diferentes usam entradas de cache distintas', async () => {
    const next = new SpyIndicatorHistoryReader(sampleHistory)
    const store = new FakeIndicatorHistoryCacheStore()
    const cached = createRedisIndicatorHistoryCache(next, store)

    await cached.getIndicatorHistory(30)
    await cached.getIndicatorHistory(90)
    await cached.getIndicatorHistory(undefined)

    expect(next.calls).toEqual([30, 90, undefined])
  })

  it('Redis fora do ar (get/set lançando) não quebra a leitura — cai pro reader real', async () => {
    const next = new SpyIndicatorHistoryReader(sampleHistory)
    const store = {
      get: async () => {
        throw new Error('connection refused')
      },
      set: async () => {
        throw new Error('connection refused')
      },
    }
    const cached = createRedisIndicatorHistoryCache(next, store)

    const result = await cached.getIndicatorHistory(30)

    expect(result).toEqual(sampleHistory)
    expect(next.calls).toEqual([30])
  })
})
