import type { NewsEventTarget } from '../news'

export type { NewsEventTarget } from '../news'

export type MacroEventDirection = 'positivo' | 'negativo' | 'misto'
export type MacroEventMagnitudeBand = 'leve' | 'moderado' | 'severo'
export type MacroEventStatus = 'pendente' | 'aplicado' | 'cancelado'

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
    // Só na visão do painel (N.11): ainda sem efeito aplicado, e se o cancelamento ainda é possível.
    scheduled?: boolean
    cancellable?: boolean
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
    // Agenda o primeiro dia de efeito (dia simulado futuro, N.11); ausente dispara já.
    apply_on_day?: number
}

export interface TriggerMacroEventAdHocInput {
    title: string
    narrative: string
    direction: MacroEventDirection
    magnitude_band: MacroEventMagnitudeBand
    affects_price: boolean
    affects_fundamentals: boolean
    targets: NewsEventTarget[]
    apply_on_day?: number
}

export type TriggerMacroEventInput = TriggerMacroEventFromTemplateInput | TriggerMacroEventAdHocInput

export interface TriggerMacroEventResult {
    event: MacroEventBase
}

// `GET /admin/audit-log` (N.4, `.docs/backend/admin.md#get-adminaudit-log`).
// `action` é a lista fechada do backend (`ADMIN_AUDIT_ACTIONS`): cada tarefa
// nova da Fase N que audite uma ação nova acrescenta aqui e em `auditLabels`.
export type AuditAction =
    | 'macro_event.trigger'
    | 'macro_event.cancel'
    | 'tick.trigger'
    | 'tick.advance'
    | 'scheduler.pause'
    | 'scheduler.resume'
    | 'order.cancel'
    | 'order.cancel_batch'
    | 'trading.halt'
    | 'trading.resume'
    | 'bot.create'
    | 'bot.update'
    | 'bot.fund'
    | 'settings.update'
    | 'settings.reset'
    | 'user.suspend'
    | 'user.reactivate'
    | 'user.force_logout'
    | 'user.delete'
    | 'admin.login'
    | 'admin.login_failed'
    | 'admin.reauth'
    | 'admin.reauth_failed'
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

// Visão geral e saúde (N.5, `.docs/backend/admin.md#visao-geral-e-saude-do-sistema-tarefa-n5`).
export type HealthStatus = 'ok' | 'degradado' | 'fora'
export type HealthComponentKey = 'backend' | 'engine' | 'gamification_db' | 'market_db' | 'redis'

export interface ComponentHealth {
    key: HealthComponentKey
    status: HealthStatus
    latency_ms: number | null
    detail: string | null
}

export interface SystemHealth {
    checked_at: string
    components: ComponentHealth[]
}

export interface MarketOverview {
    simulated_day: number
    selic_rate: number
    ipca_monthly: number | null
    ipca_accumulated_12m: number | null
    pending_macro_events: number
    uncovered_assets: number
    tradable_assets: number
    active_bots: number
    total_bots: number
    day_trades: number
    day_volume: number
    resting_orders: number
}

export interface UserStats {
    total: number
    signups_last_24h: number
    signups_last_7d: number
}

export interface AdminOverview {
    market: MarketOverview | null
    scheduler: SchedulerStatus | null
    last_tick: TickRun | null
    users: UserStats | null
    errors: Partial<Record<'market' | 'scheduler' | 'last_tick' | 'users', string>>
}

// Monitor do mercado ao vivo (N.8, `.docs/backend/admin.md#monitor-do-mercado-ao-vivo-tarefa-n8`).
export type MonitorAssetType = 'acao' | 'etf' | 'fii'
export type MonitorIndicatorKind = 'price_to_earnings' | 'nav_premium_pct' | 'price_to_book'

export interface MonitorIndicator {
    kind: MonitorIndicatorKind
    value: number
}

export interface MonitorAsset {
    asset_id: string
    ticker: string
    name: string
    type: MonitorAssetType
    sector: string | null
    last_price: number | null
    daily_change_pct: number | null
    best_bid: number | null
    best_ask: number | null
    spread_pct: number | null
    resting_orders: number
    bot_resting_orders: number
    day_trades: number
    day_volume: number
    outstanding_shares: number | null
    held_by_bots: number
    held_by_users: number
    covered: boolean
    indicator: MonitorIndicator | null
}

export interface MonitorBookLevel {
    price: number
    quantity: number
    bot_quantity: number
}

export interface MonitorTrade {
    simulated_day: number
    price: number
    quantity: number
    buyer_is_bot: boolean
}

export interface MonitorNavPoint {
    simulated_day: number
    nav: number
    close_price: number
    premium_pct: number
}

export interface MonitorAssetDetail extends MonitorAsset {
    bids: MonitorBookLevel[]
    asks: MonitorBookLevel[]
    trades: MonitorTrade[]
    quotes: Array<{ simulated_day: number; price: number }>
    nav_history: MonitorNavPoint[]
}

// Ordens do book (N.10, `.docs/backend/admin.md#ordens-do-book-consulta-e-cancelamento-por-intervenção-tarefa-n10`).
export type AdminOrderStatus = 'pending' | 'partially_filled' | 'filled' | 'cancelled'

export interface AdminOrder {
    order_id: string
    asset_id: string
    ticker: string
    user_id: string
    is_bot: boolean
    bot_archetype: string | null
    side: 'buy' | 'sell'
    type: 'market' | 'limit'
    quantity: number
    filled_quantity: number
    price: number
    status: AdminOrderStatus
    cancel_reason: string | null
    simulated_day: number
    created_at: string
}

export interface AdminOrdersFilters {
    user_id?: string
    asset_id?: string
    side?: 'buy' | 'sell'
    // 'open' junta pending e partially_filled.
    status?: 'open' | AdminOrderStatus
    from?: string
    to?: string
    limit?: number
    offset?: number
}

export interface ListAdminOrdersResult {
    orders: AdminOrder[]
    total: number
}

export interface CancelOrdersBatchInput {
    asset_id?: string
    user_id?: string
}

export interface CancelOrdersBatchResult {
    cancelled_count: number
    cancelled_ids: string[]
}

// Pausa de negociação (N.9, `.docs/backend/admin.md#pausa-de-negociação-tarefa-n9`).
export type HaltScope = 'global' | 'asset'

export interface TradingHalt {
    id: string
    scope: HaltScope
    asset_id: string | null
    ticker: string | null
    reason: string
    created_by: string
    created_at: string
    lifted_at: string | null
    lifted_by: string | null
}

export interface TradingHaltListing {
    active: TradingHalt[]
    recent: TradingHalt[]
}

export interface PauseTradingInput {
    scope: HaltScope
    asset_id?: string
    reason: string
}

// Gestão de bots (N.1/N.2, `.docs/backend/admin.md#gestão-de-bots-tarefa-n1`).
export type BotArchetype = 'ruido' | 'market_maker' | 'chartista' | 'fundamentalista'

export interface BotAssetRef {
    asset_id: string
    ticker: string
}

export interface BotHolding extends BotAssetRef {
    quantity: number
    average_price: number
}

export interface AdminBot {
    account_id: string
    archetype: BotArchetype
    is_active: boolean
    cash: number
    scope: {
        sectors: string[]
        risk_classes: string[]
        asset_classes: string[]
        within_scope_pct: number
    }
    knowledge_level: number | null
    risk_profile: {
        max_position_size_pct: number
        market_order_preference: number
        spread_width_pct: number
    }
    // Só o Market Maker tem teto e cobertura.
    max_covered_assets: number | null
    covered_assets: BotAssetRef[]
    holdings: BotHolding[]
}

// Desempenho (N.14): espelha GET /admin/bots/{id}/activity e /summary do motor.
export interface BotQuote extends BotAssetRef {
    best_bid: number | null
    best_ask: number | null
    spread_pct: number | null
    held_quantity: number
    target_quantity: number
    inventory_pct: number | null
}

export interface BotActivity {
    account_id: string
    archetype: BotArchetype
    is_active: boolean
    from_day: number
    to_day: number
    period_days: number
    cash: number
    holdings_value: number
    net_worth: number
    capital_contributed: number
    pnl: number
    pnl_pct: number | null
    orders: {
        sent: number
        filled: number
        partially_filled: number
        open: number
        cancelled: number
        cancelled_by_reason: Record<string, number>
        fill_rate_pct: number | null
    }
    trades: number
    volume: number
    last_order_at: string | null
    last_order_day: number | null
    // Só o Market Maker tem cotação.
    quotes: BotQuote[]
}

export interface BotsSummary {
    simulated_day: number
    idle_days: number
    active_bots: number
    idle_bots: Array<{ account_id: string; archetype: BotArchetype; last_order_day: number | null }>
    low_cash_bots: Array<{ account_id: string; archetype: BotArchetype; cash: number; capital: number }>
    empty_inventory: Array<{ account_id: string; asset_id: string; ticker: string }>
    liquidity: Array<{ asset_id: string; ticker: string; resting_by_provider: Record<string, number> }>
    float_concentration: Array<{
        asset_id: string
        ticker: string
        top_bot_id: string
        top_bot_archetype: BotArchetype
        top_bot_pct: number
        all_bots_pct: number
        outstanding_shares: number
    }>
}

export interface AdminBotListing {
    bots: AdminBot[]
    // Ativos negociáveis sem Market Maker ativo cobrindo.
    uncovered_assets: BotAssetRef[]
}

// Frações (0 a 1), como o motor guarda; a tela converte de e para porcentagem.
export interface CreateBotInput {
    archetype: BotArchetype
    sectors: string[]
    risk_classes: string[]
    asset_classes: string[]
    within_scope_pct: number
    knowledge_level?: number
    max_position_size_pct: number
    market_order_preference: number
    spread_width_pct: number
    max_covered_assets?: number
    initial_cash: number
}

export interface UpdateBotInput {
    is_active?: boolean
    max_covered_assets?: number
    // Conjunto final de ativos do Market Maker; lista vazia tira toda a cobertura.
    covered_asset_ids?: string[]
    // Personalidade (N.15), frações de 0 a 1. Cada lista enviada substitui a atual. A preferência
    // por ordem a mercado não é editável (achado 001).
    sectors?: string[]
    risk_classes?: string[]
    asset_classes?: string[]
    within_scope_pct?: number
    knowledge_level?: number
    max_position_size_pct?: number
    spread_width_pct?: number
}

// Aporte (N.15): só soma, nunca remove caixa nem posição.
export interface FundBotInput {
    cash?: number
    holdings?: Array<{ asset_id: string; quantity: number }>
}

// Parâmetros de simulação (N.7, `.docs/backend/admin.md#parametros-de-simulacao-tarefa-n7`).
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

export interface ReadOnlySetting {
    key: string
    value: string
    reason: string
}

export interface EngineSettings {
    editable: EditableSetting[]
    read_only: ReadOnlySetting[]
}

// Filtros do histórico de eventos macro (N.11): no máximo um filtro de alvo; o período é em
// dias simulados do primeiro dia de efeito.
export interface MacroEventFilters {
    status?: MacroEventStatus
    sector?: string
    risk_class?: string
    asset_id?: string
    from_day?: number
    to_day?: number
}

// `GET /admin/macro-events/:id` (N.11, `.docs/backend/admin.md#ciclo-de-vida-do-evento-macro-tarefa-n11`).
export interface MacroEventImpactAsset {
    asset_id: string
    ticker: string
    price_before: number
    price_after: number
    change_pct: number
}

export interface MacroEventImpactTarget extends NewsEventTarget {
    assets: MacroEventImpactAsset[]
    average_change_pct: number | null
}

export interface MacroEventImpact {
    available: boolean
    window_days: number
    base_day: number
    end_day: number
    available_on_day: number
    targets: MacroEventImpactTarget[]
}

// A versão redigida: direção e magnitude vêm vazias enquanto o evento está pendente (RF16).
export interface MacroEventUserView extends Omit<MacroEventBase, 'direction' | 'magnitude_band'> {
    direction: MacroEventDirection | ''
    magnitude_band: MacroEventMagnitudeBand | ''
}

export interface MacroEventDetail extends MacroEventBase {
    created_at: string
    created_by: string | null
    current_day: number
    report_date?: string
    publicly_visible: boolean
    impact: MacroEventImpact
    // O que o usuário vê hoje deste evento (veredito redigido enquanto pendente).
    user_view: MacroEventUserView
}

export interface CancelMacroEventResult {
    event: MacroEventBase
}

// Gestão de usuários (N.16, `.docs/backend/admin.md#gestão-de-usuários-tarefa-n16`).
export type AdminUserRole = 'user' | 'admin'
export type AdminUserStatus = 'active' | 'suspended'

export interface AdminUserSummary {
    id: string
    name: string
    email: string
    username: string
    role: AdminUserRole
    status: AdminUserStatus
    onboarding_completed: boolean
    // 'password' (senha local) e os provedores OAuth ('google').
    providers: string[]
    created_at: string
}

export interface AdminUsersFilters {
    q?: string
    role?: AdminUserRole
    status?: AdminUserStatus
    provider?: string
    created_from?: string
    created_to?: string
    limit?: number
    offset?: number
}

export interface ListAdminUsersResult {
    users: AdminUserSummary[]
    total: number
}

export interface UserPortfolioPosition {
    asset_id: string
    ticker: string
    name: string
    type: string
    is_sandbox: boolean
    quantity: number
    average_price: number
}

export interface UserPortfolio {
    cash: number
    variable_income_value: number
    fixed_income_value: number
    net_worth: number
    positions: UserPortfolioPosition[]
}

export interface AdminUserTimelineEntry {
    id: string
    admin_id: string
    admin_username: string | null
    action: AuditAction
    payload: Record<string, unknown>
    result: AuditResult
    error_message: string | null
    occurred_at: string
}

export interface AdminUserDetail {
    account: AdminUserSummary & { suspended_reason: string | null; suspended_at: string | null }
    progression: {
        xp: number
        level: number
        current_streak: number
        longest_streak: number
        last_qualifying_activity_date: string | null
    }
    achievements_count: number
    friends_count: number
    // `null` quando o motor não respondeu: o resto do detalhe continua.
    portfolio: UserPortfolio | null
    open_orders: { total: number; orders: AdminOrder[] } | null
    timeline: AdminUserTimelineEntry[]
}
