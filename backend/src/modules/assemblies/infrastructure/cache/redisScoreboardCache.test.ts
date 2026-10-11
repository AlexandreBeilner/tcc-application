import type { Redis } from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { createRedisScoreboardCache } from './redisScoreboardCache'

const board = { voters: 2, options: [{ optionId: 'o1', voters: 2, weightPercent: 100 }] }

describe('createRedisScoreboardCache', () => {
  it('guarda com TTL curto e devolve o mesmo placar', async () => {
    const data = new Map<string, string>()
    const set = vi.fn(async (k: string, v: string) => (data.set(k, v), 'OK'))
    const client = { get: vi.fn(async (k: string) => data.get(k) ?? null), set } as unknown as Redis
    const cache = createRedisScoreboardCache(client, 5)
    expect(await cache.get('a1')).toBeNull()
    await cache.set('a1', board)
    expect(set).toHaveBeenCalledWith('assemblies:scoreboard:a1', JSON.stringify(board), 'EX', 5)
    expect(await cache.get('a1')).toEqual(board)
  })

  it('Redis fora do ar nunca derruba a leitura', async () => {
    const client = {
      get: vi.fn(async () => Promise.reject(new Error('down'))),
      set: vi.fn(async () => Promise.reject(new Error('down'))),
    } as unknown as Redis
    const cache = createRedisScoreboardCache(client)
    expect(await cache.get('a1')).toBeNull()
    await expect(cache.set('a1', board)).resolves.toBeUndefined()
  })
})
