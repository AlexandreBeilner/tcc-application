import type { Redis } from 'ioredis'
import type {
  CachedSubscription,
  SubscriptionCache,
} from '../../application/ports/subscriptionCache'
import type { Subscription } from '../../domain/subscription'

const DATE_FIELDS = [
  'purchasedAt',
  'expiresAt',
  'graceExpiresAt',
  'billingIssueDetectedAt',
  'unsubscribeDetectedAt',
  'refundedAt',
  'lastEventAt',
  'updatedAt',
] as const

const keyOf = (userId: string) => `billing:subscription:${userId}`

// Datas viajam como ISO no JSON e voltam como `Date` (o JSON puro as deixaria texto).
function serialize(value: CachedSubscription): string {
  return JSON.stringify(value)
}

function deserialize(raw: string): CachedSubscription {
  const parsed = JSON.parse(raw) as { subscription: Record<string, unknown> | null }
  if (!parsed.subscription) return { subscription: null }
  const subscription: Record<string, unknown> = { ...parsed.subscription }
  for (const field of DATE_FIELDS) {
    const value = subscription[field]
    subscription[field] = typeof value === 'string' ? new Date(value) : null
  }
  return { subscription: subscription as unknown as Subscription }
}

// TTL curto de propósito: o cache só evita bater no Postgres em toda requisição gateada. A
// invalidação explícita (webhook) é que faz o cancelamento valer na hora; o TTL cobre o resto.
export function createRedisSubscriptionCache(client: Redis, ttlSeconds = 30): SubscriptionCache {
  return {
    async get(userId) {
      try {
        const raw = await client.get(keyOf(userId))
        return raw ? deserialize(raw) : null
      } catch {
        // Cache fora do ar não pode derrubar a rota: cai pro banco.
        return null
      }
    },

    async set(userId, value) {
      try {
        await client.set(keyOf(userId), serialize(value), 'EX', ttlSeconds)
      } catch {
        // idem
      }
    },

    async invalidate(userId) {
      try {
        await client.del(keyOf(userId))
      } catch {
        // Sem invalidar, o TTL curto ainda limita o atraso.
      }
    },
  }
}
