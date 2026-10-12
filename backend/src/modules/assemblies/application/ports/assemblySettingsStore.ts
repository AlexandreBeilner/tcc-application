import type { AssemblySettingKey } from '../../domain/settings'

export interface StoredAssemblySetting {
  key: string
  value: number
  updatedBy: string | null
  updatedAt: Date
}

// Parâmetros gravados pelo painel (MO.6.8). Sem linha, vale o valor inicial.
export interface AssemblySettingsStore {
  loadAll(): Promise<StoredAssemblySetting[]>
  upsert(key: AssemblySettingKey, value: number, adminId: string, now: Date): Promise<void>
  remove(key: AssemblySettingKey): Promise<void>
}
