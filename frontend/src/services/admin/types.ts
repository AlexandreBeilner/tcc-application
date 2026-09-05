import type { NewsEventTarget } from '../news'

export type { NewsEventTarget } from '../news'

export type MacroEventDirection = 'positivo' | 'negativo' | 'misto'
export type MacroEventMagnitudeBand = 'leve' | 'moderado' | 'severo'
export type MacroEventStatus = 'pendente' | 'aplicado'

// Campos comuns às duas respostas do motor (`.docs/engine/macroevent.md`) —
// `created_at` só existe na de `GET /macro-events` (repassada por `GET
// /admin/macro-events`), nunca na de `POST` (`Trigger` devolve um
// `macroevent.Event`, sem o timestamp gravado pelo banco).
export interface MacroEventBase {
    id: string
    template_key?: string
    title: string
    narrative: string
    direction: MacroEventDirection
    magnitude_band: MacroEventMagnitudeBand
    affects_price: boolean
    affects_fundamentals: boolean
    status: MacroEventStatus
    triggered_on_day: number
    duration_days: number
    price_effect_pct?: number
    fundamentals_effect_pct?: number
    fundamentals_report_day?: number
    targets: NewsEventTarget[]
}

// Item de `GET /admin/macro-events` (tela 10.1) — `status` reflete o
// estado atual (`pendente`/`aplicado`), atualizado a cada tick, não um
// valor congelado da criação (`.docs/backend/admin.md`).
export interface MacroEvent extends MacroEventBase {
    created_at: string
}

export interface ListMacroEventsResult {
    events: MacroEvent[]
    total_entries: number
}

// União das duas variantes de `POST /admin/macro-events` (schema Zod do
// backend, `triggerMacroEventBodySchema`) — a partir de um template do
// catálogo (só `targets` vem do payload) ou evento avulso (todos os campos
// textuais/de efeito obrigatórios). Tela 10.2 espelha isso como um toggle
// "usar template" vs. "evento avulso", não dois formulários visualmente
// distintos (backlog 6.11).
export interface TriggerMacroEventFromTemplateInput {
    template_key: string
    targets: NewsEventTarget[]
}

export interface TriggerMacroEventAdHocInput {
    title: string
    narrative: string
    direction: MacroEventDirection
    magnitude_band: MacroEventMagnitudeBand
    affects_price: boolean
    affects_fundamentals: boolean
    targets: NewsEventTarget[]
}

export type TriggerMacroEventInput = TriggerMacroEventFromTemplateInput | TriggerMacroEventAdHocInput

export interface TriggerMacroEventResult {
    event: MacroEventBase
}
