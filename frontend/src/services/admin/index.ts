import { apiDownload, apiRequest } from '../client'
import type { DownloadedFile } from '../client'
import type {
    AchievementCatalog,
    DailyChangeImpact,
    DailyDraftResult,
    DailyEvent,
    DailyEventInput,
    DailyMetricsDay,
    DailyOverview,
    DailyPatch,
    DailyPuzzleDetail,
    DailyQuestion,
    DailyQuestionInput,
    DailyReplaceCardInput,
    DailyStartDateResult,
    DailyWord,
    DailyWordInput,
    AdminRanking,
    AdminRankingFilters,
    CatalogAchievement,
    CatalogMission,
    AdminLesson,
    AdminLessonContent,
    AdminLessonForEdit,
    LessonCardFunnel,
    LessonCreateInput,
    LessonCreateResult,
    LessonRevisionContent,
    LessonSaveResult,
    LessonPublicationResult,
    CreateAchievementInput,
    UpdateAchievementInput,
    UpdateMissionInput,
    CorrectedProgression,
    CreditUserInput,
    CreditUserResult,
    UserCorrectionContext,
    AdminUserDetail,
    AdminUsersFilters,
    ListAdminUsersResult,
    AdminBot,
    AdminBotListing,
    BotActivity,
    BotsSummary,
    CreateBotInput,
    FundBotInput,
    UpdateBotInput,
    AdminOverview,
    AdminRetention,
    AdminRetentionParams,
    AdminOrdersFilters,
    AdvanceTicksResult,
    AuditLogFilters,
    CancelMacroEventResult,
    MacroEventDetail,
    MacroEventFilters,
    CancelOrdersBatchInput,
    CancelOrdersBatchResult,
    CatalogAsset,
    CatalogPatch,
    CreatedCatalogAsset,
    EngineSettingGroup,
    EngineSettingKey,
    EngineSettings,
    ListAdminOrdersResult,
    NewCatalogAsset,
    NewCatalogAssetPreview,
    ListAuditLogResult,
    ListMacroEventsResult,
    ListTicksResult,
    MonitorAsset,
    MonitorAssetDetail,
    AdminAnnouncement,
    AnnouncementInput,
    AnnouncementPatch,
    EndAnnouncementResult,
    ExportDataset,
    ExportFilters,
    IntegrityRun,
    MaintenanceInput,
    PauseTradingInput,
    SchedulerStatus,
    SystemHealth,
    TickResult,
    TradingHalt,
    TradingHaltListing,
    AdminAssembly,
    AdminAssemblyDetail,
    AdminAssemblyStatus,
    AgendaTemplate,
    AgendaTemplateContent,
    AssemblyPause,
    AssemblyPauseListing,
    AssemblySetting,
    AssemblySettingKey,
    PauseAssembliesInput,
    TriggerMacroEventInput,
    TriggerMacroEventResult,
    UserProStatus,
    GrantUserProInput,
    GrantUserProResult,
} from './types'

export type {
    DailyAgendaDay,
    DailyAlertCode,
    DailyCardOrigin,
    DailyLearnMore,
    DailyLearnMoreKind,
    DailyScope,
    DailyStatus,
    DailyTally,
    DailyChangeImpact,
    DailyDraftResult,
    DailyEvent,
    DailyEventInput,
    DailyMetricsDay,
    DailyOverview,
    DailyPatch,
    DailyPuzzleDetail,
    DailyQuestion,
    DailyQuestionInput,
    DailyReplaceCardInput,
    DailyStartDateResult,
    DailyWord,
    DailyWordInput,
    UserProStatus,
    GrantUserProInput,
    GrantUserProResult,
    AdminLesson,
    AdminLessonContent,
    AdminLessonDetail,
    AdminLessonForEdit,
    LessonCreateInput,
    LessonCreateResult,
    LessonRevisionAction,
    LessonRevisionContent,
    LessonRevisionItem,
    LessonSaveResult,
    LessonFunnel,
    LessonCardFunnel,
    LessonCardFunnelBar,
    LessonMicroDecisionType,
    LessonPublicationResult,
    AchievementCatalog,
    AchievementCriteriaType,
    AchievementCriterionOption,
    AdminRanking,
    AdminRankingCriterion,
    AdminRankingEntry,
    AdminRankingFilters,
    AdminRankingWindow,
    CatalogAchievement,
    CatalogMission,
    CreateAchievementInput,
    MissionVerification,
    UpdateAchievementInput,
    UpdateMissionInput,
    CorrectedProgression,
    CorrectionAchievement,
    CorrectionLesson,
    CorrectionLessonStatus,
    CreditUserInput,
    CreditUserResult,
    UserCorrectionContext,
    AdminUserDetail,
    AdminUserRole,
    AdminUserStatus,
    AdminUserSummary,
    AdminUserTimelineEntry,
    AdminUsersFilters,
    ListAdminUsersResult,
    UserPortfolio,
    UserPortfolioPosition,
    CancelMacroEventResult,
    MacroEventDetail,
    MacroEventFilters,
    MacroEventImpact,
    MacroEventImpactAsset,
    MacroEventImpactTarget,
    EditableSetting,
    EngineSettingKey,
    EngineSettings,
    ReadOnlySetting,
    CatalogAsset,
    CatalogCompany,
    CatalogEditableField,
    CatalogETF,
    CatalogFII,
    CatalogFixedIncome,
    CatalogPatch,
    CatalogPoolPreview,
    CreatedCatalogAsset,
    NewCatalogAsset,
    NewCatalogAssetKind,
    NewCatalogAssetPreview,
    AdminBot,
    AdminBotListing,
    BotArchetype,
    BotAssetRef,
    BotActivity,
    BotHolding,
    BotQuote,
    BotsSummary,
    CreateBotInput,
    FundBotInput,
    UpdateBotInput,
    ExportDataset,
    ExportFilters,
    IntegrityDivergence,
    IntegrityKind,
    IntegrityReport,
    IntegrityRun,
    AdminAnnouncement,
    AnnouncementInput,
    AnnouncementKind,
    AnnouncementPatch,
    AnnouncementSeverity,
    AnnouncementStatus,
    EndAnnouncementResult,
    MaintenanceInput,
    HaltScope,
    PauseTradingInput,
    TradingHalt,
    TradingHaltListing,
    AdminAssembly,
    AdminAssemblyDetail,
    AdminAssemblyOption,
    AdminEffectPreview,
    AdminAssemblyStatus,
    AdminAssemblyVote,
    AgendaTemplate,
    AgendaTemplateContent,
    AgendaTemplateEffect,
    AgendaTemplateOption,
    AgendaTemplatePurpose,
    AssemblyPause,
    AssemblyPauseListing,
    AssemblySetting,
    AssemblySettingKey,
    EngineSettingGroup,
    GovernanceSettingKey,
    PaceSettingKey,
    PauseAssembliesInput,
    AdminOrder,
    AdminOrdersFilters,
    AdminOrderStatus,
    CancelOrdersBatchInput,
    CancelOrdersBatchResult,
    ListAdminOrdersResult,
    AdminOverview,
    AdminRetention,
    AdminRetentionParams,
    RetentionActiveDay,
    RetentionCell,
    RetentionCellStatus,
    RetentionCohort,
    RetentionDays,
    RetentionMilestone,
    RetentionMilestoneCohort,
    RetentionMilestoneSummary,
    RetentionTrackingStart,
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
export function listMacroEvents(
    token: string,
    limit?: number,
    offset?: number,
    filters: MacroEventFilters = {},
): Promise<ListMacroEventsResult> {
    const params = new URLSearchParams()
    if (limit !== undefined) params.set('limit', String(limit))
    if (offset !== undefined) params.set('offset', String(offset))
    // Filtros do painel (N.11): só os preenchidos entram na query string.
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) params.set(key, String(value))
    }
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

// Painel de retenção (RT.1.2): coortes, ativos por dia e marcos, só números agregados.
export function getAdminRetention(token: string, { weeks, days }: AdminRetentionParams): Promise<AdminRetention> {
    return apiRequest<AdminRetention>(`/admin/retention?weeks=${weeks}&days=${days}`, { token })
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

export function fundAdminBot(token: string, botId: string, input: FundBotInput): Promise<AdminBot> {
    return apiRequest<AdminBot>(`/admin/bots/${botId}/funding`, { token, method: 'POST', body: input })
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

// Cada tela lê o seu grupo: o Tempo (padrão) o ritmo do Temporizador, as Assembleias a governança.
export function getEngineSettings(token: string, group: EngineSettingGroup = 'pace'): Promise<EngineSettings> {
    const query = group === 'pace' ? '' : `?group=${group}`
    return apiRequest<EngineSettings>(`/admin/settings${query}`, { token })
}

export function updateEngineSetting(token: string, key: EngineSettingKey, value: number): Promise<EngineSettings> {
    return apiRequest<EngineSettings>(`/admin/settings/${key}`, { token, method: 'PUT', body: { value } })
}

export function resetEngineSetting(token: string, key: EngineSettingKey): Promise<EngineSettings> {
    return apiRequest<EngineSettings>(`/admin/settings/${key}`, { token, method: 'DELETE' })
}

// Catálogo de ativos (N.12): consulta e ajuste de uma lista fechada de campos.
export async function listAdminCatalog(token: string): Promise<CatalogAsset[]> {
    return (await apiRequest<{ assets: CatalogAsset[] }>('/admin/catalog', { token })).assets
}

export function updateCatalogAsset(token: string, assetId: string, patch: CatalogPatch): Promise<CatalogAsset> {
    return apiRequest<CatalogAsset>(`/admin/catalog/${assetId}`, { token, method: 'PATCH', body: patch })
}

// Cadastro de ativo novo (N.13): o preview mostra o que seria criado sem gravar nada.
export function previewCatalogAsset(token: string, asset: NewCatalogAsset): Promise<NewCatalogAssetPreview> {
    return apiRequest<NewCatalogAssetPreview>('/admin/catalog/preview', { token, method: 'POST', body: asset })
}

export function createCatalogAsset(token: string, asset: NewCatalogAsset): Promise<CreatedCatalogAsset> {
    return apiRequest<CreatedCatalogAsset>('/admin/catalog', { token, method: 'POST', body: asset })
}

// Detalhe de um evento macro (N.11): estado de ciclo de vida, impacto realizado e a versão
// que o usuário vê.
export function getMacroEventDetail(token: string, id: string, windowDays?: number): Promise<MacroEventDetail> {
    const query = windowDays === undefined ? '' : `?window_days=${windowDays}`
    return apiRequest<MacroEventDetail>(`/admin/macro-events/${id}${query}`, { token })
}

// Cancela um evento pendente que ainda não produziu efeito (N.11).
export function cancelMacroEvent(token: string, id: string): Promise<CancelMacroEventResult> {
    return apiRequest<CancelMacroEventResult>(`/admin/macro-events/${id}`, { token, method: 'DELETE' })
}

// Gestão de usuários (N.16). Suspender, reativar, forçar logout e excluir respondem 204.
export function listAdminUsers(token: string, filters: AdminUsersFilters = {}): Promise<ListAdminUsersResult> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) params.set(key, String(value))
    }
    const query = params.toString()
    return apiRequest<ListAdminUsersResult>(`/admin/users${query ? `?${query}` : ''}`, { token })
}

export function getAdminUser(token: string, userId: string): Promise<AdminUserDetail> {
    return apiRequest<AdminUserDetail>(`/admin/users/${userId}`, { token })
}

export function suspendAdminUser(token: string, userId: string, reason: string): Promise<void> {
    return apiRequest<void>(`/admin/users/${userId}/suspend`, { token, method: 'POST', body: { reason } })
}

export function reactivateAdminUser(token: string, userId: string): Promise<void> {
    return apiRequest<void>(`/admin/users/${userId}/reactivate`, { token, method: 'POST' })
}

export function forceLogoutAdminUser(token: string, userId: string): Promise<void> {
    return apiRequest<void>(`/admin/users/${userId}/force-logout`, { token, method: 'POST' })
}

export function deleteAdminUser(token: string, userId: string, confirmUsername: string): Promise<void> {
    return apiRequest<void>(`/admin/users/${userId}`, { token, method: 'DELETE', body: { confirm_username: confirmUsername } })
}

export function getUserCorrectionContext(token: string, userId: string): Promise<UserCorrectionContext> {
    return apiRequest<UserCorrectionContext>(`/admin/users/${userId}/corrections`, { token })
}

export function getAdminUserPro(token: string, userId: string): Promise<UserProStatus> {
    return apiRequest<UserProStatus>(`/admin/users/${userId}/pro`, { token })
}

export function grantAdminUserPro(token: string, userId: string, input: GrantUserProInput): Promise<GrantUserProResult> {
    return apiRequest<GrantUserProResult>(`/admin/users/${userId}/pro-grants`, { token, method: 'POST', body: input })
}

export function creditAdminUser(token: string, userId: string, input: CreditUserInput): Promise<CreditUserResult> {
    return apiRequest<CreditUserResult>(`/admin/users/${userId}/credit`, { token, method: 'POST', body: input })
}

export function adjustAdminUserXp(token: string, userId: string, delta: number, reason: string): Promise<CorrectedProgression> {
    return apiRequest<CorrectedProgression>(`/admin/users/${userId}/xp`, { token, method: 'POST', body: { delta, reason } })
}

export function setAdminUserStreak(token: string, userId: string, value: number, reason: string): Promise<CorrectedProgression> {
    return apiRequest<CorrectedProgression>(`/admin/users/${userId}/streak`, { token, method: 'POST', body: { value, reason } })
}

export type LessonCorrection = 'complete' | 'reopen'

export function grantAdminUserAchievement(token: string, userId: string, achievementId: string, reason: string): Promise<void> {
    return apiRequest<void>(`/admin/users/${userId}/achievements/${achievementId}/grant`, { token, method: 'POST', body: { reason } })
}

export function correctAdminUserLesson(
    token: string,
    userId: string,
    lessonId: string,
    action: LessonCorrection,
    reason: string,
): Promise<void> {
    return apiRequest<void>(`/admin/users/${userId}/lessons/${lessonId}/${action}`, { token, method: 'POST', body: { reason } })
}

export function getAchievementCatalog(token: string): Promise<AchievementCatalog> {
    return apiRequest<AchievementCatalog>('/admin/gamification/achievements', { token })
}

export function createAchievement(token: string, input: CreateAchievementInput): Promise<CatalogAchievement> {
    return apiRequest<CatalogAchievement>('/admin/gamification/achievements', { token, method: 'POST', body: input })
}

export function updateAchievement(token: string, id: string, input: UpdateAchievementInput): Promise<CatalogAchievement> {
    return apiRequest<CatalogAchievement>(`/admin/gamification/achievements/${id}`, { token, method: 'PATCH', body: input })
}

export function getMissionCatalog(token: string): Promise<{ missions: CatalogMission[] }> {
    return apiRequest<{ missions: CatalogMission[] }>('/admin/gamification/missions', { token })
}

export function updateMission(token: string, id: string, input: UpdateMissionInput): Promise<CatalogMission> {
    return apiRequest<CatalogMission>(`/admin/gamification/missions/${id}`, { token, method: 'PATCH', body: input })
}

export function getAdminRanking(token: string, filters: AdminRankingFilters): Promise<AdminRanking> {
    const params = new URLSearchParams({ criterion: filters.criterion, page: String(filters.page) })
    if (filters.window) params.set('window', filters.window)
    return apiRequest<AdminRanking>(`/admin/gamification/ranking?${params.toString()}`, { token })
}

export function getAdminLessons(token: string) {
    return apiRequest<{ lessons: AdminLesson[] }>('/admin/lessons', { token })
}

export function getLessonCardFunnel(token: string, id: string, days: number) {
    return apiRequest<LessonCardFunnel>(`/admin/lessons/${id}/card-funnel?days=${days}`, { token })
}

export function setLessonPublished(token: string, id: string, published: boolean) {
    return apiRequest<LessonPublicationResult>(`/admin/lessons/${id}/published`, { token, method: 'PATCH', body: { published } })
}

export function getAdminLesson(token: string, id: string) {
    return apiRequest<AdminLessonForEdit>(`/admin/lessons/${id}`, { token })
}

export function updateAdminLesson(token: string, id: string, content: AdminLessonContent) {
    return apiRequest<LessonSaveResult>(`/admin/lessons/${id}`, { token, method: 'PUT', body: content })
}

export function createAdminLesson(token: string, input: LessonCreateInput) {
    return apiRequest<LessonCreateResult>('/admin/lessons', { token, method: 'POST', body: input })
}

export function getLessonRevision(token: string, lessonId: string, revisionId: string) {
    return apiRequest<LessonRevisionContent>(`/admin/lessons/${lessonId}/revisions/${revisionId}`, { token })
}

export function restoreLessonRevision(token: string, lessonId: string, revisionId: string) {
    return apiRequest<LessonSaveResult>(`/admin/lessons/${lessonId}/revisions/${revisionId}/restore`, { token, method: 'POST' })
}

// Contadores do Diário (DI.7.1): um dia por linha, do mais recente ao mais antigo.
export function getDailyMetrics(token: string, days = 30) {
    return apiRequest<{ days: DailyMetricsDay[] }>(`/admin/daily/metrics?days=${days}`, { token })
}

// Painel do Diário (DI.5.1). Mudar a data da estreia pede senha recente (`withReauth`).
export function getDailyOverview(token: string) {
    return apiRequest<DailyOverview>('/admin/daily', { token })
}

export function prepareDailyDraft(token: string, startDate: string) {
    return apiRequest<DailyDraftResult>('/admin/daily/draft', { token, method: 'POST', body: { start_date: startDate } })
}

export function setDailyStartDate(token: string, startDate: string | null) {
    return apiRequest<DailyStartDateResult>('/admin/daily/start-date', { token, method: 'PUT', body: { start_date: startDate } })
}

export function publishDailyPuzzles(token: string, numbers?: number[]) {
    return apiRequest<{ published: number[] }>('/admin/daily/puzzles/publish', { token, method: 'POST', body: numbers ? { numbers } : {} })
}

export function getDailyPuzzle(token: string, number: number) {
    return apiRequest<DailyPuzzleDetail>(`/admin/daily/puzzles/${number}`, { token })
}

export function reviewDailyPuzzle(token: string, number: number) {
    return apiRequest<{ number: number }>(`/admin/daily/puzzles/${number}/review`, { token, method: 'POST' })
}

export function replaceDailyCard(token: string, number: number, input: DailyReplaceCardInput) {
    return apiRequest<{ number: number }>(`/admin/daily/puzzles/${number}/card`, { token, method: 'PUT', body: input })
}

export function getDailyWords(token: string) {
    return apiRequest<{ words: DailyWord[] }>('/admin/daily/words', { token })
}

export function createDailyWord(token: string, input: DailyWordInput) {
    return apiRequest<{ word: DailyWord }>('/admin/daily/words', { token, method: 'POST', body: input })
}

export function updateDailyWord(token: string, id: string, patch: DailyPatch<DailyWordInput>) {
    return apiRequest<{ word: DailyWord } & DailyChangeImpact>(`/admin/daily/words/${id}`, { token, method: 'PATCH', body: patch })
}

export function getDailyAcceptedWords(token: string) {
    return apiRequest<{ words: string[] }>('/admin/daily/accepted-words', { token })
}

export function addDailyAcceptedWord(token: string, word: string) {
    return apiRequest<{ word: string }>('/admin/daily/accepted-words', { token, method: 'POST', body: { word } })
}

export function removeDailyAcceptedWord(token: string, word: string) {
    return apiRequest<{ word: string }>(`/admin/daily/accepted-words/${encodeURIComponent(word)}`, { token, method: 'DELETE' })
}

export function getDailyQuestions(token: string) {
    return apiRequest<{ questions: DailyQuestion[] }>('/admin/daily/questions', { token })
}

export function createDailyQuestion(token: string, input: DailyQuestionInput) {
    return apiRequest<{ question: DailyQuestion }>('/admin/daily/questions', { token, method: 'POST', body: input })
}

export function updateDailyQuestion(token: string, id: string, patch: DailyPatch<DailyQuestionInput>) {
    return apiRequest<{ question: DailyQuestion } & DailyChangeImpact>(`/admin/daily/questions/${id}`, {
        token,
        method: 'PATCH',
        body: patch,
    })
}

export function getDailyEvents(token: string) {
    return apiRequest<{ events: DailyEvent[] }>('/admin/daily/events', { token })
}

export function createDailyEvent(token: string, input: DailyEventInput) {
    return apiRequest<{ event: DailyEvent }>('/admin/daily/events', { token, method: 'POST', body: input })
}

export function updateDailyEvent(token: string, id: string, patch: DailyPatch<DailyEventInput>) {
    return apiRequest<{ event: DailyEvent } & DailyChangeImpact>(`/admin/daily/events/${id}`, { token, method: 'PATCH', body: patch })
}

// Comunicados globais e modo de manutenção (N.20). Encerrar a manutenção levanta a pausa de
// negociação que ela abriu; abrir manutenção com pausa pede senha recente (`withReauth`).
export function listAdminAnnouncements(token: string): Promise<{ announcements: AdminAnnouncement[] }> {
    return apiRequest<{ announcements: AdminAnnouncement[] }>('/admin/announcements', { token })
}

export function createAnnouncement(token: string, input: AnnouncementInput): Promise<AdminAnnouncement> {
    return apiRequest<AdminAnnouncement>('/admin/announcements', { token, method: 'POST', body: input })
}

export function updateAnnouncement(token: string, id: string, patch: AnnouncementPatch): Promise<AdminAnnouncement> {
    return apiRequest<AdminAnnouncement>(`/admin/announcements/${id}`, { token, method: 'PATCH', body: patch })
}

export function endAnnouncement(token: string, id: string): Promise<EndAnnouncementResult> {
    return apiRequest<EndAnnouncementResult>(`/admin/announcements/${id}/end`, { token, method: 'POST' })
}

export function startMaintenance(token: string, input: MaintenanceInput): Promise<AdminAnnouncement> {
    return apiRequest<AdminAnnouncement>('/admin/maintenance', { token, method: 'POST', body: input })
}

// Integridade financeira (N.21): abre a verificação (202, roda em segundo plano no motor) e lê a
// última. `run` é nulo se nenhuma rodou desde a subida do motor.
export function startIntegrityCheck(token: string): Promise<IntegrityRun> {
    return apiRequest<IntegrityRun>('/admin/integrity/check', { token, method: 'POST' })
}

export async function getIntegrityRun(token: string): Promise<IntegrityRun | null> {
    return (await apiRequest<{ run: IntegrityRun | null }>('/admin/integrity/check', { token })).run
}

// Exportação CSV (N.21). Só `users` pede senha recente (`reauth_required`), então quem chama
// embrulha em `withReauth`.
export function downloadAdminExport(token: string, dataset: ExportDataset, filters: ExportFilters = {}): Promise<DownloadedFile> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) params.set(key, String(value))
    }
    const query = params.toString()
    return apiDownload(`/admin/exports/${dataset}${query ? `?${query}` : ''}`, { token })
}

// Assembleias (MO.6.8): leitura com voto por pessoa, pausa, parâmetros e catálogo de pautas.
export async function listAdminAssemblies(token: string, status?: AdminAssemblyStatus): Promise<AdminAssembly[]> {
    const query = status ? `?status=${status}` : ''
    return (await apiRequest<{ assemblies: AdminAssembly[] }>(`/admin/assemblies${query}`, { token })).assemblies
}

export function getAdminAssembly(token: string, id: string): Promise<AdminAssemblyDetail> {
    return apiRequest<AdminAssemblyDetail>(`/admin/assemblies/${id}`, { token })
}

export function listAssemblyPauses(token: string): Promise<AssemblyPauseListing> {
    return apiRequest<AssemblyPauseListing>('/admin/assemblies/pauses', { token })
}

export function pauseAssemblies(token: string, input: PauseAssembliesInput): Promise<AssemblyPause> {
    return apiRequest<AssemblyPause>('/admin/assemblies/pauses', { token, method: 'POST', body: input })
}

export function liftAssemblyPause(token: string, pauseId: string): Promise<AssemblyPause> {
    return apiRequest<AssemblyPause>(`/admin/assemblies/pauses/${pauseId}/lift`, { token, method: 'POST' })
}

export async function listAssemblySettings(token: string): Promise<AssemblySetting[]> {
    return (await apiRequest<{ settings: AssemblySetting[] }>('/admin/assemblies/settings', { token })).settings
}

export async function updateAssemblySetting(token: string, key: AssemblySettingKey, value: number): Promise<AssemblySetting[]> {
    return (
        await apiRequest<{ settings: AssemblySetting[] }>(`/admin/assemblies/settings/${key}`, { token, method: 'PUT', body: { value } })
    ).settings
}

export async function resetAssemblySetting(token: string, key: AssemblySettingKey): Promise<AssemblySetting[]> {
    return (await apiRequest<{ settings: AssemblySetting[] }>(`/admin/assemblies/settings/${key}`, { token, method: 'DELETE' })).settings
}

export async function listAgendaTemplates(token: string): Promise<AgendaTemplate[]> {
    return (await apiRequest<{ templates: AgendaTemplate[] }>('/admin/assemblies/agenda-templates', { token })).templates
}

export function createAgendaTemplate(token: string, key: string, content: AgendaTemplateContent): Promise<AgendaTemplate> {
    return apiRequest<AgendaTemplate>('/admin/assemblies/agenda-templates', { token, method: 'POST', body: { key, ...content } })
}

export function updateAgendaTemplate(token: string, key: string, content: AgendaTemplateContent): Promise<AgendaTemplate> {
    return apiRequest<AgendaTemplate>(`/admin/assemblies/agenda-templates/${key}`, { token, method: 'PUT', body: content })
}

export function setAgendaTemplateActive(token: string, key: string, active: boolean): Promise<AgendaTemplate> {
    return apiRequest<AgendaTemplate>(`/admin/assemblies/agenda-templates/${key}/active`, { token, method: 'POST', body: { active } })
}
