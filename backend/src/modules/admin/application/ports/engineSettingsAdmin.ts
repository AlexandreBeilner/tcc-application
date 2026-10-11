// Espelha GET/PUT/DELETE /admin/settings do motor (tarefa N.7) — mesmos nomes de campo
// (snake_case), sem tradução.
export type PaceSettingKey = 'ticks_per_day' | 'max_catch_up'
// Faixa de efeito, rampa e cooldown da Assembleia de Acionistas (MO.6.2), mais payout, prêmio da PN
// e retenção da declaração de dividendo (MO.6.10 a MO.6.12), editados na tela das assembleias
// (MO.6.8). O motor aplica a decisão com os valores do momento em que a recebe.
export type GovernanceSettingKey =
  | 'governance_growth_step_centipp'
  | 'governance_quality_step_centi'
  | 'governance_ramp_ticks'
  | 'governance_cooldown_days'
  | 'governance_payout_step_centipp'
  | 'governance_payout_min_pct'
  | 'governance_payout_max_pct'
  | 'governance_payout_cooldown_days'
  | 'governance_premium_step_centipp'
  | 'governance_premium_min_pct'
  | 'governance_premium_max_pct'
  | 'governance_hold_declarations'
  | 'governance_declaration_safety_days'
export type EngineSettingKey = PaceSettingKey | GovernanceSettingKey
// Cada tela lê o seu grupo: o Tempo (10.11) só o ritmo, as Assembleias só a governança.
export type EngineSettingGroup = 'pace' | 'governance'

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
  list(group?: EngineSettingGroup): Promise<EngineSettings>
  set(key: EngineSettingKey, value: number, adminId: string): Promise<EngineSettings>
  reset(key: EngineSettingKey): Promise<EngineSettings>
}
