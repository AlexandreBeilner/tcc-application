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

// `GET /admin/audit-log` (N.4, `.docs/backend/admin.md#get-adminaudit-log`).
// `action` é a lista fechada do backend (`ADMIN_AUDIT_ACTIONS`): cada tarefa
// nova da Fase N que audite uma ação nova acrescenta aqui e em `auditLabels`.
export type AuditAction = 'macro_event.trigger' | 'tick.trigger' | 'tick.advance' | 'scheduler.pause' | 'scheduler.resume'
export type AuditResult = 'success' | 'failed'

export interface AuditLogEntry {
    id: string
    admin_id: string
    admin_username: string | null
    action: AuditAction
    target_type: string
    target_id: string | null
    payload: Record<string, unknown>
    result: AuditResult
    error_message: string | null
    occurred_at: string
}

export interface ListAuditLogResult {
    entries: AuditLogEntry[]
    total_entries: number
}

export interface AuditLogFilters {
    action?: AuditAction
    result?: AuditResult
    // ISO 8601 com fuso (o backend recusa data sem fuso).
    from?: string
    to?: string
    limit?: number
    offset?: number
}

// Painel de Tempo (N.6, `.docs/backend/admin.md#painel-de-tempo-tarefa-n6`).
export interface SchedulerStatus {
    enabled: boolean
    paused: boolean
    resumed_at: string | null
    ticks_per_day: number
    timezone: string
    max_catch_up: number
    next_slot_at: string | null
    tick_in_progress: boolean
    last_tick_at: string | null
}

export type TickTrigger = 'scheduled' | 'catchup' | 'manual'
export type TickRunStatus = 'success' | 'failed'

export interface TickRun {
    simulated_day: number | null
    trigger: TickTrigger
    status: TickRunStatus
    error_message: string | null
    started_at: string
    duration_ms: number
    catch_up_discarded: number
    selic_rate: number | null
    is_copom_day: boolean
    is_report_day: boolean
    quotes_count: number
    fundamentals_count: number
    dividends_generated_count: number
    dividends_paid_count: number
    bot_fills_count: number
    expired_orders_count: number
    uncovered_assets_count: number
    intraday_rounds_count: number
}

export interface ListTicksResult {
    ticks: TickRun[]
    total_entries: number
}

// Corpo de `POST /admin/tick` (e de cada item de `POST /admin/tick/advance`).
export interface TickResult {
    day: number
    selic_rate: number
    quotes_count: number
    fundamentals_count: number
    is_copom_day: boolean
    is_report_day: boolean
    dividends_generated_count: number
    dividends_paid_count: number
    bot_fills_count: number
    expired_orders_count: number
    uncovered_assets_count: number
    intraday_rounds_count: number
}

export interface AdvanceTicksResult {
    requested: number
    ticks: TickResult[]
}
