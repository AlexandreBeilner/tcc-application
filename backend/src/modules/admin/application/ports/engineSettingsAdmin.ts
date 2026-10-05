// Espelha GET/PUT/DELETE /admin/settings do motor (tarefa N.7) — mesmos nomes de campo
// (snake_case), sem tradução.
export type EngineSettingKey = 'ticks_per_day' | 'max_catch_up'

export interface EditableSetting {
  key: EngineSettingKey
  value: number
  default: number
  min: number
  max: number
  overridden: boolean
  updated_by: string | null
  updated_at: string | null
  version: number
}

// Valor que o painel mostra sem controle de edição (regra financeira ou invariante).
export interface ReadOnlySetting {
  key: string
  value: string
  reason: string
}

export interface EngineSettings {
  editable: EditableSetting[]
  read_only: ReadOnlySetting[]
}

// Parâmetros de ritmo do Temporizador, guardados no banco "market" (dono é o motor). A
// faixa de cada chave é validada no domínio do motor; `adminId` vai pra ele gravar quem
// alterou por último.
export interface EngineSettingsAdmin {
  list(): Promise<EngineSettings>
  set(key: EngineSettingKey, value: number, adminId: string): Promise<EngineSettings>
  reset(key: EngineSettingKey): Promise<EngineSettings>
}
