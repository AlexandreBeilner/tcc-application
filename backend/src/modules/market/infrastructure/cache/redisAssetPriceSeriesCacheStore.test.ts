import { describe, expect, it, vi } from 'vitest'
import type { Redis } from 'ioredis'
import { createRedisAssetPriceSeriesCacheStore } from './redisAssetPriceSeriesCacheStore'

function fakeClient(overrides: Partial<Redis> = {}): Redis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    ...overrides,
  } as unknown as Redis
}

describe('createRedisAssetPriceSeriesCacheStore', () => {
  it('get: chave ausente é null', async () => {
    expect(await createRedisAssetPriceSeriesCacheStore(fakeClient()).get('k')).toBeNull()
  })

  it('get: desserializa o JSON gravado', async () => {
    const client = fakeClient({ get: vi.fn().mockResolvedValue(JSON.stringify({ a: [1, 2] })) })
    expect(await createRedisAssetPriceSeriesCacheStore(client).get('k')).toEqual({ a: [1, 2] })
  })

  it('set: grava com EX no TTL informado', async () => {
    const set = vi.fn().mockResolvedValue('OK')
    await createRedisAssetPriceSeriesCacheStore(fakeClient({ set })).set('k', { a: [1] }, 300)
    expect(set).toHaveBeenCalledWith('k', JSON.stringify({ a: [1] }), 'EX', 300)
  })
})
