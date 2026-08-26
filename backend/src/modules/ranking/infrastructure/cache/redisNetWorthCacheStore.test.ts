import { describe, expect, it, vi } from 'vitest'
import type { Redis } from 'ioredis'
import { createRedisNetWorthCacheStore } from './redisNetWorthCacheStore'
import type { Snapshot } from '../../domain/networth'

const sampleSnapshot: Snapshot = {
  cash: 1000,
  variableIncomeValue: 500,
  fixedIncomeValue: 0,
  tradesExecuted: 2,
  total: 1500,
}

function fakeRedisClient(overrides: Partial<Redis> = {}): Redis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    ...overrides,
  } as unknown as Redis
}

describe('createRedisNetWorthCacheStore', () => {
  it('get: chave ausente devolve null (cache frio/miss)', async () => {
    const client = fakeRedisClient()
    const store = createRedisNetWorthCacheStore(client)

    const result = await store.get('networth:user-1:current')

    expect(result).toBeNull()
  })

  it('get: desserializa o JSON gravado por set', async () => {
    const client = fakeRedisClient({
      get: vi.fn().mockResolvedValue(JSON.stringify(sampleSnapshot)),
    })
    const store = createRedisNetWorthCacheStore(client)

    const result = await store.get('networth:user-1:current')

    expect(result).toEqual(sampleSnapshot)
  })

  it('set: grava com EX no TTL informado', async () => {
    const setMock = vi.fn().mockResolvedValue('OK')
    const client = fakeRedisClient({ set: setMock })
    const store = createRedisNetWorthCacheStore(client)

    await store.set('networth:user-1:current', sampleSnapshot, 300)

    expect(setMock).toHaveBeenCalledWith(
      'networth:user-1:current',
      JSON.stringify(sampleSnapshot),
      'EX',
      300,
    )
  })
})
