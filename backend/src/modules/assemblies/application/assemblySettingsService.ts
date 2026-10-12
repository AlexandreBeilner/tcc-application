import { InvalidAssemblySettingError } from '../domain/errors'
import {
  applyOverrides,
  ASSEMBLY_SETTING_RANGES,
  isAssemblySettingKey,
  validateSettingValue,
  valuesOf,
  type AssemblySettingKey,
  type AssemblySettingOverrides,
  type AssemblyTunables,
} from '../domain/settings'
import type { AssemblySettingsStore } from './ports/assemblySettingsStore'

export interface AssemblySettingView {
  key: AssemblySettingKey
  value: number
  // Valor inicial (variável de ambiente ou padrão do código): o que "restaurar" devolve.
  default: number
  min: number
  max: number
  overridden: boolean
  updatedBy: string | null
  updatedAt: Date | null
}

// Parâmetros das assembleias em runtime (MO.6.8). `live` é o objeto de configuração que o resto do
// módulo lê a cada uso (as funções `() => config.params` da composição); `refresh` o atualiza com
// o que o painel gravou por cima do valor inicial `base`. O backend roda como instância única, então
// atualizar depois de cada escrita e a cada rodada do ciclo basta.
export class AssemblySettingsService {
  constructor(
    private readonly base: AssemblyTunables,
    private readonly live: AssemblyTunables,
    private readonly store: AssemblySettingsStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async refresh(): Promise<void> {
    const stored = await this.store.loadAll()
    const overrides: AssemblySettingOverrides = {}
    for (const row of stored) {
      if (isAssemblySettingKey(row.key)) overrides[row.key] = row.value
    }
    Object.assign(this.live, applyOverrides(this.base, overrides))
  }

  async list(): Promise<AssemblySettingView[]> {
    const stored = new Map((await this.store.loadAll()).map((row) => [row.key, row]))
    const defaults = valuesOf(this.base)
    const current = valuesOf(this.live)
    return ASSEMBLY_SETTING_RANGES.map(({ key, min, max }) => {
      const row = stored.get(key)
      return {
        key,
        value: current[key],
        default: defaults[key],
        min,
        max,
        overridden: row !== undefined,
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt ?? null,
      }
    })
  }

  async set(key: string, value: number, adminId: string): Promise<AssemblySettingView[]> {
    const validKey = this.requireKey(key)
    validateSettingValue(validKey, value)
    await this.store.upsert(validKey, value, adminId, this.now())
    await this.refresh()
    return this.list()
  }

  async reset(key: string): Promise<AssemblySettingView[]> {
    await this.store.remove(this.requireKey(key))
    await this.refresh()
    return this.list()
  }

  private requireKey(key: string): AssemblySettingKey {
    if (!isAssemblySettingKey(key)) throw new InvalidAssemblySettingError('parâmetro desconhecido')
    return key
  }
}
