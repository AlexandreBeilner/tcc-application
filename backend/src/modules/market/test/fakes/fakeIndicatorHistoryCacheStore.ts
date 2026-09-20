import type { IndicatorHistoryCacheStore } from '../../application/ports/indicatorHistoryCacheStore'
import type { IndicatorHistoryEntry } from '../../application/ports/indicatorHistoryReader'

// Espião em memória de IndicatorHistoryCacheStore — conta chamadas a
// get/set, determinístico (sem Redis real nem latência de parede), mesmo
// padrão de FakeNetWorthCacheStore (modules/ranking, tarefa 5.7).
export class FakeIndicatorHistoryCacheStore implements IndicatorHistoryCacheStore {
  private readonly entries = new Map<string, IndicatorHistoryEntry[]>()
  getCalls = 0
  setCalls = 0

  async get(key: string): Promise<IndicatorHistoryEntry[] | null> {
    this.getCalls++
    return this.entries.get(key) ?? null
  }

  async set(key: string, value: IndicatorHistoryEntry[]): Promise<void> {
    this.setCalls++
    this.entries.set(key, value)
  }
}
