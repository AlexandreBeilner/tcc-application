import type { Snapshot } from '../../domain/networth'

// Porta pequena pro cache de leitura de NetWorthReader (tarefa 5.7) —
// implementada contra Redis em infrastructure/cache/redisNetWorthCacheStore.ts.
// TTL é responsabilidade de quem escreve (set), não do store — "current"
// (asOf omitido em GetNetWorthInput) muda continuamente com o mercado, por
// isso um TTL curto (ver redisNetWorthCache.ts).
export interface NetWorthCacheStore {
  get(key: string): Promise<Snapshot | null>
  set(key: string, value: Snapshot, ttlSeconds: number): Promise<void>
}
