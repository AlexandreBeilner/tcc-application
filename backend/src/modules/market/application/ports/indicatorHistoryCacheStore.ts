import type { IndicatorHistoryEntry } from './indicatorHistoryReader'

// Porta pequena pro cache de leitura de IndicatorHistoryReader (tarefa
// M.3, mesmo padrão de NetWorthCacheStore em modules/ranking — tarefa
// 5.7). TTL é responsabilidade de quem escreve (set), não do store.
export interface IndicatorHistoryCacheStore {
  get(key: string): Promise<IndicatorHistoryEntry[] | null>
  set(key: string, value: IndicatorHistoryEntry[], ttlSeconds: number): Promise<void>
}
