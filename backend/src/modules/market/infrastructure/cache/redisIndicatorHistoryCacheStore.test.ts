import { describe, expect, it, vi } from 'vitest'
import type { Redis } from 'ioredis'
import { createRedisIndicatorHistoryCacheStore } from './redisIndicatorHistoryCacheStore'
import type { IndicatorHistoryEntry } from '../../application/ports/indicatorHistoryReader'

const sampleHistory: IndicatorHistoryEntry[] = [
  { simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.0037, ipca_accumulated_12m: 0.045 },
]

function fakeRedisClient(overrides: Partial<Redis> = {}): Redis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    ...overrides,
  } as unknown as Redis
}

describe('createRedisIndicatorHistoryCacheStore', () => {
  it('get: chave ausente devolve null (cache frio/miss)', async () => {
    const client = fakeRedisClient()
    const store = createRedisIndicatorHistoryCacheStore(client)

    const result = await store.get('indicators:history:90')

    expect(result).toBeNull()
  })

  it('get: desserializa o JSON gravado por set', async () => {
    const client = fakeRedisClient({
      get: vi.fn().mockResolvedValue(JSON.stringify(sampleHistory)),
    })
    const store = createRedisIndicatorHistoryCacheStore(client)

    const result = await store.get('indicators:history:90')

    expect(result).toEqual(sampleHistory)
  })

  it('set: grava com EX no TTL informado', async () => {
    const setMock = vi.fn().mockResolvedValue('OK')
    const client = fakeRedisClient({ set: setMock })
    const store = createRedisIndicatorHistoryCacheStore(client)

    await store.set('indicators:history:90', sampleHistory, 300)

    expect(setMock).toHaveBeenCalledWith(
      'indicators:history:90',
      JSON.stringify(sampleHistory),
      'EX',
      300,
    )
  })
})
