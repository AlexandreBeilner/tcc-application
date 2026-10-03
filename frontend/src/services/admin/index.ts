import { apiRequest } from '../client'
import type {
    AdminOverview,
    AdvanceTicksResult,
    AuditLogFilters,
    ListAuditLogResult,
    ListMacroEventsResult,
    ListTicksResult,
    SchedulerStatus,
    SystemHealth,
    TickResult,
    TriggerMacroEventInput,
    TriggerMacroEventResult,
} from './types'

export type {
    AdminOverview,
    ComponentHealth,
    HealthComponentKey,
    HealthStatus,
    MarketOverview,
    SystemHealth,
    UserStats,
    AdvanceTicksResult,
    AuditAction,
    AuditLogEntry,
    AuditLogFilters,
    AuditResult,
    ListAuditLogResult,
    ListTicksResult,
    MacroEvent,
    MacroEventBase,
    MacroEventDirection,
    MacroEventMagnitudeBand,
    MacroEventStatus,
    ListMacroEventsResult,
    NewsEventTarget,
    SchedulerStatus,
    TickResult,
    TickRun,
    TickRunStatus,
    TickTrigger,
    TriggerMacroEventAdHocInput,
    TriggerMacroEventFromTemplateInput,
    TriggerMacroEventInput,
    TriggerMacroEventResult,
} from './types'

// Tela 10.1 (`.docs/backend/admin.md#get-adminmacro-events`) — mesma
// convenção limit/offset de `listNews`.
export function listMacroEvents(token: string, limit?: number, offset?: number): Promise<ListMacroEventsResult> {
    const params = new URLSearchParams()
    if (limit !== undefined) params.set('limit', String(limit))
    if (offset !== undefined) params.set('offset', String(offset))
    const query = params.toString()
    return apiRequest<ListMacroEventsResult>(`/admin/macro-events${query ? `?${query}` : ''}`, { token })
}

// Tela 10.2 (`.docs/backend/admin.md#post-adminmacro-events`) — `input` já
// é uma das duas variantes válidas do schema Zod do backend, resolvidas no
// client antes de chamar esta função (`MacroEventTriggerForm`).
export function triggerMacroEvent(token: string, input: TriggerMacroEventInput): Promise<TriggerMacroEventResult> {
    return apiRequest<TriggerMacroEventResult>('/admin/macro-events', { token, method: 'POST', body: input })
}

// Tela 10.4 (`.docs/backend/admin.md#get-adminaudit-log`) — só os filtros
// preenchidos entram na query string.
export function listAuditLog(token: string, filters: AuditLogFilters = {}): Promise<ListAuditLogResult> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) params.set(key, String(value))
    }
    const query = params.toString()
    return apiRequest<ListAuditLogResult>(`/admin/audit-log${query ? `?${query}` : ''}`, { token })
}

// Painel de Tempo (N.6). `triggerTick` é o `POST /admin/tick` que já existia no
// backend (3.11/7.3) e nunca teve cliente no frontend.
export function getScheduler(token: string): Promise<SchedulerStatus> {
    return apiRequest<SchedulerStatus>('/admin/scheduler', { token })
}

export function pauseScheduler(token: string): Promise<SchedulerStatus> {
    return apiRequest<SchedulerStatus>('/admin/scheduler/pause', { token, method: 'POST' })
}

export function resumeScheduler(token: string): Promise<SchedulerStatus> {
    return apiRequest<SchedulerStatus>('/admin/scheduler/resume', { token, method: 'POST' })
}

export function listTicks(token: string, limit?: number, offset?: number): Promise<ListTicksResult> {
    const params = new URLSearchParams()
    if (limit !== undefined) params.set('limit', String(limit))
    if (offset !== undefined) params.set('offset', String(offset))
    const query = params.toString()
    return apiRequest<ListTicksResult>(`/admin/ticks${query ? `?${query}` : ''}`, { token })
}

export function triggerTick(token: string): Promise<TickResult> {
    return apiRequest<TickResult>('/admin/tick', { token, method: 'POST' })
}

export function advanceTicks(token: string, days: number): Promise<AdvanceTicksResult> {
    return apiRequest<AdvanceTicksResult>('/admin/tick/advance', { token, method: 'POST', body: { days } })
}

// Visão geral e saúde (N.5): só leitura.
export function getSystemHealth(token: string): Promise<SystemHealth> {
    return apiRequest<SystemHealth>('/admin/system/health', { token })
}

export function getAdminOverview(token: string): Promise<AdminOverview> {
    return apiRequest<AdminOverview>('/admin/overview', { token })
}
