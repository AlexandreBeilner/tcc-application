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
  // Agenda o primeiro dia de efeito (dia simulado futuro, N.11); ausente dispara já.
  apply_on_day?: number
  // Com quantos dias de antecedência do efeito o jogador vê o evento (N.25); ausente, a véspera.
  reveal_lead_days?: number
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
  apply_on_day?: number
  reveal_lead_days?: number
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
  reveal_lead_days?: number
  duration_days: number
  price_effect_pct?: number
  fundamentals_effect_pct?: number
  fundamentals_report_day?: number
  // Mesmo formato de MacroEventTargetInput (sector?/risk_class?/asset_id?,
  // exatamente um preenchido) — reaproveitado em vez de duplicar um tipo
  // idêntico só porque um é usado em request e o outro em response.
  targets: MacroEventTargetInput[]
  // Só presente em itens vindos de GET /macro-events (list) — POST
  // /macro-events (trigger) não devolve created_at (tarefa 6.6.1, motor:
  // .docs/engine/macroevent.md). Timestamp real (RFC 3339), diferente de
  // triggered_on_day (dia simulado).
  created_at?: string
  // Só na visão do painel de GET /macro-events (N.11): o evento ainda não produziu
  // efeito, e se o cancelamento ainda é possível.
  scheduled?: boolean
  cancellable?: boolean
}

// Abre um evento macro no motor de simulação — accounts/macro_events vivem
// no banco "market", dono é o motor, nunca escrito direto por aqui (mesmo
// raciocínio de AccountProvisioner, módulo auth).
export interface MacroEventTrigger {
  trigger(input: TriggerMacroEventInput): Promise<MacroEventResult>
}
