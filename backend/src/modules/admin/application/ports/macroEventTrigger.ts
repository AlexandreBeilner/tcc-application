// Espelha o payload/resposta de POST /macro-events do motor de simulação
// (tarefa 4.4) — mesmos nomes de campo (snake_case), sem tradução: o
// backend é só o portão de autenticação/autorização (role = admin) na
// frente do motor, não dono da regra de negócio do evento.
export interface MacroEventTargetInput {
  sector?: string
  risk_class?: string
  asset_id?: string
}

export interface MacroEventFromTemplateInput {
  template_key: string
  targets: MacroEventTargetInput[]
  created_by?: string
}

export interface MacroEventAdHocInput {
  title: string
  narrative: string
  direction: 'positivo' | 'negativo' | 'misto'
  magnitude_band: 'leve' | 'moderado' | 'severo'
  affects_price: boolean
  affects_fundamentals: boolean
  targets: MacroEventTargetInput[]
  created_by?: string
}

export type TriggerMacroEventInput = MacroEventFromTemplateInput | MacroEventAdHocInput

export interface MacroEventResult {
  id: string
  template_key?: string
  title: string
  narrative: string
  direction: string
  magnitude_band: string
  affects_price: boolean
  affects_fundamentals: boolean
  status: string
  triggered_on_day: number
  duration_days: number
  price_effect_pct?: number
  fundamentals_effect_pct?: number
  fundamentals_report_day?: number
}

// Abre um evento macro no motor de simulação — accounts/macro_events vivem
// no banco "market", dono é o motor, nunca escrito direto por aqui (mesmo
// raciocínio de AccountProvisioner, módulo auth).
export interface MacroEventTrigger {
  trigger(input: TriggerMacroEventInput): Promise<MacroEventResult>
}
