import type { Redis } from 'ioredis'
import type { NetWorthCacheStore } from '../../application/ports/netWorthCacheStore'
import type { Snapshot } from '../../domain/networth'

// Implementação Redis de NetWorthCacheStore (tarefa 5.7) — Snapshot é um
// objeto plano só de números, serializa sem perda em JSON (sem Date/Map).
export function createRedisNetWorthCacheStore(client: Redis): NetWorthCacheStore {
  return {
    async get(key: string): Promise<Snapshot | null> {
      const raw = await client.get(key)
      if (!raw) return null
      return JSON.parse(raw) as Snapshot
    },

    async set(key: string, value: Snapshot, ttlSeconds: number): Promise<void> {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    },
  }
}
