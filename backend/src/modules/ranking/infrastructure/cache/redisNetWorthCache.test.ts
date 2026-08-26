import { describe, expect, it } from 'vitest'
import { createRedisNetWorthCache } from './redisNetWorthCache'
import { FakeNetWorthCacheStore } from '../../test/fakes/fakeNetWorthCacheStore'
import type { GetNetWorthInput, NetWorthReader } from '../../application/useCases/getNetWorth'
import type { Snapshot } from '../../domain/networth'

// Espião de NetWorthReader — conta quantas vezes o "repositório real"
// (GetNetWorthUseCase, aqui substituído por um fake) é de fato chamado.
class SpyNetWorthReader implements NetWorthReader {
  calls = 0
  constructor(private readonly snapshot: Snapshot) {}

  async execute(): Promise<Snapshot> {
    this.calls++
    return this.snapshot
  }
}

const sampleSnapshot: Snapshot = {
  cash: 1000,
  variableIncomeValue: 500,
  fixedIncomeValue: 0,
  tradesExecuted: 2,
  total: 1500,
}

describe('createRedisNetWorthCache', () => {
  it('cache frio: chama o reader real e popula o cache', async () => {
    const next = new SpyNetWorthReader(sampleSnapshot)
    const store = new FakeNetWorthCacheStore()
    const cached = createRedisNetWorthCache(next, store)

    const result = await cached.execute({ userId: 'user-1', sandboxAssetIds: new Set() })

    expect(result).toEqual(sampleSnapshot)
    expect(next.calls).toBe(1)
    expect(store.setCalls).toBe(1)
  })

  it('segunda leitura do mesmo dado não chama o reader real de novo (cache quente)', async () => {
    const next = new SpyNetWorthReader(sampleSnapshot)
    const store = new FakeNetWorthCacheStore()
    const cached = createRedisNetWorthCache(next, store)
    const input: GetNetWorthInput = { userId: 'user-1', sandboxAssetIds: new Set() }

    await cached.execute(input)
    const second = await cached.execute(input)

    expect(second).toEqual(sampleSnapshot)
    expect(next.calls).toBe(1)
  })

  it('userId ou asOf diferentes usam entradas de cache distintas', async () => {
    const next = new SpyNetWorthReader(sampleSnapshot)
    const store = new FakeNetWorthCacheStore()
    const cached = createRedisNetWorthCache(next, store)

    await cached.execute({ userId: 'user-1', sandboxAssetIds: new Set() })
    await cached.execute({ userId: 'user-2', sandboxAssetIds: new Set() })
    await cached.execute({
      userId: 'user-1',
      asOf: new Date('2026-01-01'),
      sandboxAssetIds: new Set(),
    })

    expect(next.calls).toBe(3)
  })

  it('cache frio (store vazio) não quebra a leitura — cai pro reader real', async () => {
    const next = new SpyNetWorthReader(sampleSnapshot)
    const store = new FakeNetWorthCacheStore()
    const cached = createRedisNetWorthCache(next, store)

    const result = await cached.execute({ userId: 'user-novo', sandboxAssetIds: new Set() })

    expect(result).toEqual(sampleSnapshot)
  })

  it('Redis fora do ar (get/set lançando) não quebra a leitura — cai pro reader real', async () => {
    const next = new SpyNetWorthReader(sampleSnapshot)
    const store = {
      get: async () => {
        throw new Error('connection refused')
      },
      set: async () => {
        throw new Error('connection refused')
      },
    }
    const cached = createRedisNetWorthCache(next, store)

    const result = await cached.execute({ userId: 'user-1', sandboxAssetIds: new Set() })

    expect(result).toEqual(sampleSnapshot)
    expect(next.calls).toBe(1)
  })
})
