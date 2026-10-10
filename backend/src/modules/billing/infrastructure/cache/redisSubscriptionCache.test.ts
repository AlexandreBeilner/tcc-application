import { describe, expect, it, vi } from 'vitest'
import type { Redis } from 'ioredis'
import type { Subscription } from '../../domain/subscription'
import { createRedisSubscriptionCache } from './redisSubscriptionCache'

const subscription: Subscription = {
  userId: 'u1',
  store: 'stripe',
  productId: 'pro_monthly',
  period: 'monthly',
  purchasedAt: new Date('2026-10-01T00:00:00Z'),
  expiresAt: new Date('2026-11-01T00:00:00Z'),
  graceExpiresAt: null,
  billingIssueDetectedAt: null,
  unsubscribeDetectedAt: null,
  refundedAt: null,
  isSandbox: false,
  managementUrl: null,
  lastEventAt: null,
  updatedAt: new Date('2026-10-05T00:00:00Z'),
}

// Redis em memória mínimo: o suficiente pra provar a ida e a volta pela serialização.
function memoryRedis() {
  const data = new Map<string, string>()
  return {
    data,
    client: {
      get: vi.fn(async (key: string) => data.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        data.set(key, value)
        return 'OK'
      }),
      del: vi.fn(async (key: string) => (data.delete(key) ? 1 : 0)),
    } as unknown as Redis,
  }
}

describe('createRedisSubscriptionCache', () => {
  it('miss devolve null', async () => {
    const cache = createRedisSubscriptionCache(memoryRedis().client)
    expect(await cache.get('u1')).toBeNull()
  })

  it('guarda e devolve a assinatura com as datas como Date', async () => {
    const cache = createRedisSubscriptionCache(memoryRedis().client)
    await cache.set('u1', { subscription })
    expect(await cache.get('u1')).toEqual({ subscription })
  })

  it('guarda também o "é free" (subscription nula), pra não consultar o banco de novo', async () => {
    const cache = createRedisSubscriptionCache(memoryRedis().client)
    await cache.set('u2', { subscription: null })
    expect(await cache.get('u2')).toEqual({ subscription: null })
  })

  it('grava com EX no TTL informado', async () => {
    const { client } = memoryRedis()
    await createRedisSubscriptionCache(client, 45).set('u1', { subscription: null })
    expect(client.set).toHaveBeenCalledWith('billing:subscription:u1', expect.any(String), 'EX', 45)
  })

  it('invalidate apaga a chave', async () => {
    const cache = createRedisSubscriptionCache(memoryRedis().client)
    await cache.set('u1', { subscription })
    await cache.invalidate('u1')
    expect(await cache.get('u1')).toBeNull()
  })

  it('Redis fora do ar não derruba: get vira miss e set/invalidate são silenciosos', async () => {
    const broken = {
      get: vi.fn().mockRejectedValue(new Error('down')),
      set: vi.fn().mockRejectedValue(new Error('down')),
      del: vi.fn().mockRejectedValue(new Error('down')),
    } as unknown as Redis
    const cache = createRedisSubscriptionCache(broken)
    expect(await cache.get('u1')).toBeNull()
    await expect(cache.set('u1', { subscription })).resolves.toBeUndefined()
    await expect(cache.invalidate('u1')).resolves.toBeUndefined()
  })
})
