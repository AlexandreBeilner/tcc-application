import type { Redis } from 'ioredis'
import type { IndicatorHistoryCacheStore } from '../../application/ports/indicatorHistoryCacheStore'
import type { IndicatorHistoryEntry } from '../../application/ports/indicatorHistoryReader'

// Implementação Redis de IndicatorHistoryCacheStore (tarefa M.3) — a série
// é um array de objetos planos só de números, serializa sem perda em JSON
// (sem Date/Map), mesmo padrão de redisNetWorthCacheStore.ts.
export function createRedisIndicatorHistoryCacheStore(client: Redis): IndicatorHistoryCacheStore {
  return {
    async get(key: string): Promise<IndicatorHistoryEntry[] | null> {
      const raw = await client.get(key)
      if (!raw) return null
      return JSON.parse(raw) as IndicatorHistoryEntry[]
    },

    async set(key: string, value: IndicatorHistoryEntry[], ttlSeconds: number): Promise<void> {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    },
  }
}
