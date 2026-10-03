import { apiRequest } from '../client'
import type {
    AdminBot,
    AdminBotListing,
    BotActivity,
    BotsSummary,
    CreateBotInput,
    UpdateBotInput,
    AdminOverview,
    AdminOrdersFilters,
    AdvanceTicksResult,
    AuditLogFilters,
    CancelOrdersBatchInput,
    CancelOrdersBatchResult,
    ListAdminOrdersResult,
    ListAuditLogResult,
    ListMacroEventsResult,
    ListTicksResult,
    MonitorAsset,
    MonitorAssetDetail,
    PauseTradingInput,
    SchedulerStatus,
    SystemHealth,
    TickResult,
    TradingHalt,
    TradingHaltListing,
    TriggerMacroEventInput,
    TriggerMacroEventResult,
} from './types'

export type {
    AdminBot,
    AdminBotListing,
    BotArchetype,
    BotAssetRef,
    BotActivity,
    BotHolding,
    BotQuote,
    BotsSummary,
    CreateBotInput,
    UpdateBotInput,
    HaltScope,
    PauseTradingInput,
    TradingHalt,
    TradingHaltListing,
    AdminOrder,
    AdminOrdersFilters,
    AdminOrderStatus,
    CancelOrdersBatchInput,
    CancelOrdersBatchResult,
    ListAdminOrdersResult,
    AdminOverview,
    ComponentHealth,
    HealthComponentKey,
    HealthStatus,
    MarketOverview,
    MonitorAsset,
    MonitorAssetDetail,
    MonitorAssetType,
    MonitorBookLevel,
    MonitorIndicator,
    MonitorIndicatorKind,
    MonitorNavPoint,
    MonitorTrade,
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

// Monitor do mercado ao vivo (N.8): só leitura.
export function listMarketMonitor(token: string): Promise<{ assets: MonitorAsset[] }> {
    return apiRequest<{ assets: MonitorAsset[] }>('/admin/market/assets', { token })
}

export function getMarketMonitorAsset(token: string, assetId: string): Promise<MonitorAssetDetail> {
    return apiRequest<MonitorAssetDetail>(`/admin/market/assets/${assetId}`, { token })
}

// Ordens do book (N.10): busca e cancelamento por intervenção. O cancelamento de uma
// ordem responde 204 (sem corpo).
export function listAdminOrders(token: string, filters: AdminOrdersFilters = {}): Promise<ListAdminOrdersResult> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) params.set(key, String(value))
    }
    const query = params.toString()
    return apiRequest<ListAdminOrdersResult>(`/admin/orders${query ? `?${query}` : ''}`, { token })
}

export function cancelAdminOrder(token: string, orderId: string): Promise<void> {
    return apiRequest<void>(`/admin/orders/${orderId}/cancel`, { token, method: 'POST' })
}

export function cancelAdminOrdersBatch(token: string, input: CancelOrdersBatchInput): Promise<CancelOrdersBatchResult> {
    return apiRequest<CancelOrdersBatchResult>('/admin/orders/cancel-batch', { token, method: 'POST', body: input })
}

// Pausa de negociação (N.9): lista, pausa e retomada. Retomar responde com a pausa encerrada.
export function listTradingHalts(token: string): Promise<TradingHaltListing> {
    return apiRequest<TradingHaltListing>('/admin/halts', { token })
}

export function pauseTrading(token: string, input: PauseTradingInput): Promise<TradingHalt> {
    return apiRequest<TradingHalt>('/admin/halts', { token, method: 'POST', body: input })
}

export function liftTradingHalt(token: string, haltId: string): Promise<TradingHalt> {
    return apiRequest<TradingHalt>(`/admin/halts/${haltId}/lift`, { token, method: 'POST' })
}

// Gestão de bots (N.1/N.2): lista com cobertura e posições, criação e alteração (interruptor,
// teto e cobertura de Market Maker).
export function listAdminBots(token: string): Promise<AdminBotListing> {
    return apiRequest<AdminBotListing>('/admin/bots', { token })
}

export function createAdminBot(token: string, input: CreateBotInput): Promise<AdminBot> {
    return apiRequest<AdminBot>('/admin/bots', { token, method: 'POST', body: input })
}

export function updateAdminBot(token: string, botId: string, input: UpdateBotInput): Promise<AdminBot> {
    return apiRequest<AdminBot>(`/admin/bots/${botId}`, { token, method: 'PATCH', body: input })
}

// Desempenho dos bots (N.14): só leitura. `days` e `idleDays` ausentes usam o padrão do motor.
export function getAdminBotActivity(token: string, botId: string, days?: number): Promise<BotActivity> {
    const query = days === undefined ? '' : `?days=${days}`
    return apiRequest<BotActivity>(`/admin/bots/${botId}/activity${query}`, { token })
}

export function getAdminBotsSummary(token: string, idleDays?: number): Promise<BotsSummary> {
    const query = idleDays === undefined ? '' : `?idle_days=${idleDays}`
    return apiRequest<BotsSummary>(`/admin/bots/summary${query}`, { token })
}
