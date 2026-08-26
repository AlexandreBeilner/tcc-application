import type { NetWorthCacheStore } from '../../application/ports/netWorthCacheStore'
import type { Snapshot } from '../../domain/networth'

// Espião em memória de NetWorthCacheStore — conta chamadas a get/set,
// determinístico (sem Redis real nem latência de parede), pro critério de
// aceite da tarefa 5.7 ("após aquecer o cache, uma segunda leitura do
// mesmo dado não chama o repositório real de novo").
export class FakeNetWorthCacheStore implements NetWorthCacheStore {
  private readonly entries = new Map<string, Snapshot>()
  getCalls = 0
  setCalls = 0

  async get(key: string): Promise<Snapshot | null> {
    this.getCalls++
    return this.entries.get(key) ?? null
  }

  async set(key: string, value: Snapshot): Promise<void> {
    this.setCalls++
    this.entries.set(key, value)
  }
}
