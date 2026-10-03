import cors from 'cors'
import express, { Express } from 'express'
import { createDb } from './db/client'
import { createRedisClient } from './infra/redisClient'
import { healthRouter } from './routes/health'
import { jsonErrorHandler } from './shared/http/errorHandler'
import { statusRouter } from './routes/status'
import { createEngineMacroEventTrigger } from './modules/admin/infrastructure/engine/engineMacroEventTrigger'
import { createEngineMacroEventReader } from './modules/admin/infrastructure/engine/engineMacroEventReader'
import { createEngineTickTrigger } from './modules/admin/infrastructure/engine/engineTickTrigger'
import { TriggerMacroEventUseCase } from './modules/admin/application/useCases/triggerMacroEvent'
import { ListMacroEventsUseCase } from './modules/admin/application/useCases/listMacroEvents'
import { TriggerTickUseCase } from './modules/admin/application/useCases/triggerTick'
import { createAdminMacroEventsRouter } from './modules/admin/interfaces/http/adminMacroEventsRouter'
import { createEngineMacroEventAdmin } from './modules/admin/infrastructure/engine/engineMacroEventAdmin'
import { createNewsUserViewProjector } from './modules/admin/infrastructure/news/newsUserViewProjector'
import { GetMacroEventDetailUseCase } from './modules/admin/application/useCases/getMacroEventDetail'
import { CancelMacroEventUseCase } from './modules/admin/application/useCases/cancelMacroEvent'
import { createAdminTickRouter } from './modules/admin/interfaces/http/adminTickRouter'
import { createAdminSchedulerRouter } from './modules/admin/interfaces/http/adminSchedulerRouter'
import { createEngineSchedulerAdmin } from './modules/admin/infrastructure/engine/engineSchedulerAdmin'
import { GetSchedulerStatusUseCase } from './modules/admin/application/useCases/getSchedulerStatus'
import { ListTicksUseCase } from './modules/admin/application/useCases/listTicks'
import { SetSchedulerPausedUseCase } from './modules/admin/application/useCases/setSchedulerPaused'
import { AdvanceTicksUseCase } from './modules/admin/application/useCases/advanceTicks'
import { createEngineMarketOverviewReader } from './modules/admin/infrastructure/engine/engineMarketOverviewReader'
import { createDrizzleUserStatsReader } from './modules/admin/infrastructure/persistence/drizzleUserStatsReader'
import {
  createDatabaseProbe,
  createEngineHealthProbe,
  createMarketDatabaseProbe,
  createRedisProbe,
} from './modules/admin/infrastructure/health/probes'
import { GetSystemHealthUseCase } from './modules/admin/application/useCases/getSystemHealth'
import { GetAdminOverviewUseCase } from './modules/admin/application/useCases/getAdminOverview'
import { createAdminSystemRouter } from './modules/admin/interfaces/http/adminSystemRouter'
import { createEngineMarketMonitorReader } from './modules/admin/infrastructure/engine/engineMarketMonitorReader'
import { ListMarketMonitorUseCase } from './modules/admin/application/useCases/listMarketMonitor'
import { GetMarketMonitorAssetUseCase } from './modules/admin/application/useCases/getMarketMonitorAsset'
import { createAdminMarketRouter } from './modules/admin/interfaces/http/adminMarketRouter'
import { createEngineOrderAdmin } from './modules/admin/infrastructure/engine/engineOrderAdmin'
import { ListAdminOrdersUseCase } from './modules/admin/application/useCases/listAdminOrders'
import { CancelAdminOrderUseCase } from './modules/admin/application/useCases/cancelAdminOrder'
import { CancelAdminOrdersBatchUseCase } from './modules/admin/application/useCases/cancelAdminOrdersBatch'
import { createAdminOrdersRouter } from './modules/admin/interfaces/http/adminOrdersRouter'
import { createEngineTradingHaltAdmin } from './modules/admin/infrastructure/engine/engineTradingHaltAdmin'
import { ListTradingHaltsUseCase } from './modules/admin/application/useCases/listTradingHalts'
import { PauseTradingUseCase } from './modules/admin/application/useCases/pauseTrading'
import { LiftTradingHaltUseCase } from './modules/admin/application/useCases/liftTradingHalt'
import { createAdminHaltsRouter } from './modules/admin/interfaces/http/adminHaltsRouter'
import { createEngineSettingsAdmin } from './modules/admin/infrastructure/engine/engineSettingsAdmin'
import { ListEngineSettingsUseCase } from './modules/admin/application/useCases/listEngineSettings'
import { UpdateEngineSettingUseCase } from './modules/admin/application/useCases/updateEngineSetting'
import { ResetEngineSettingUseCase } from './modules/admin/application/useCases/resetEngineSetting'
import { createAdminSettingsRouter } from './modules/admin/interfaces/http/adminSettingsRouter'
import { createEngineBotAdmin } from './modules/admin/infrastructure/engine/engineBotAdmin'
import { FundAdminBotUseCase } from './modules/admin/application/useCases/fundAdminBot'
import { GetAdminBotActivityUseCase } from './modules/admin/application/useCases/getAdminBotActivity'
import { GetAdminBotsSummaryUseCase } from './modules/admin/application/useCases/getAdminBotsSummary'
import { ListAdminBotsUseCase } from './modules/admin/application/useCases/listAdminBots'
import { CreateAdminBotUseCase } from './modules/admin/application/useCases/createAdminBot'
import { UpdateAdminBotUseCase } from './modules/admin/application/useCases/updateAdminBot'
import { createAdminBotsRouter } from './modules/admin/interfaces/http/adminBotsRouter'
import { createAdminAuditLogRouter } from './modules/admin/interfaces/http/adminAuditLogRouter'
import { createDrizzleAuditLogRepository } from './modules/admin/infrastructure/persistence/drizzleAuditLogRepository'
import { RecordAdminActionUseCase } from './modules/admin/application/useCases/recordAdminAction'
import { ListAuditLogUseCase } from './modules/admin/application/useCases/listAuditLog'
import { createAdminPingRouter } from './modules/admin/interfaces/http/pingRouter'
import { ListNewsFeedUseCase } from './modules/news/application/useCases/listNewsFeed'
import { MarkNewsEventAsSeenUseCase } from './modules/news/application/useCases/markNewsEventAsSeen'
import { createInProcessNewsFeedReader } from './modules/news/infrastructure/admin/inProcessNewsFeedReader'
import { createDrizzleNewsReadRepository } from './modules/news/infrastructure/persistence/drizzleNewsReadRepository'
import { createNewsRouter } from './modules/news/interfaces/http/newsRouter'
import { CheckAndUnlockAchievementsUseCase } from './modules/achievements/application/useCases/checkAndUnlockAchievements'
import { ExportUnlockedAchievementsUseCase } from './modules/achievements/application/useCases/exportUnlockedAchievements'
import { ListAchievementsUseCase } from './modules/achievements/application/useCases/listAchievements'
import { createInProcessProgressSnapshotReader } from './modules/achievements/infrastructure/aggregation/inProcessProgressSnapshotReader'
import { createDrizzleAchievementRepository } from './modules/achievements/infrastructure/persistence/drizzleAchievementRepository'
import { createAchievementsRouter } from './modules/achievements/interfaces/http/achievementsRouter'
import { AwardXpUseCase } from './modules/gamification/application/useCases/awardXp'
import { GetProgressionUseCase } from './modules/gamification/application/useCases/getProgression'
import { TouchStreakUseCase } from './modules/gamification/application/useCases/touchStreak'
import { createInProcessAchievementChecker } from './modules/gamification/infrastructure/achievements/inProcessAchievementChecker'
import { createInProcessAchievementChecker as createInProcessAchievementCheckerForLessons } from './modules/lessons/infrastructure/gamification/inProcessAchievementChecker'
import { createInProcessMonthlySalaryReader } from './modules/gamification/infrastructure/payroll/inProcessMonthlySalaryReader'
import { createDrizzleProgressionRepository } from './modules/gamification/infrastructure/persistence/drizzleProgressionRepository'
import { createProgressionRouter } from './modules/gamification/interfaces/http/progressionRouter'
import { createStreakRouter } from './modules/gamification/interfaces/http/streakRouter'
import { LESSON_MIN_STEP_INTERVAL_MS } from './modules/lessons/domain/lesson'
import { AdvanceLessonUseCase } from './modules/lessons/application/useCases/advanceLesson'
import { CountCompletedLessonsUseCase } from './modules/lessons/application/useCases/countCompletedLessons'
import { GetCurrentMicroDecisionStreakUseCase } from './modules/lessons/application/useCases/getCurrentMicroDecisionStreak'
import { GetTracksCompletedWithoutErrorsCountUseCase } from './modules/lessons/application/useCases/getTracksCompletedWithoutErrorsCount'
import { CountReviewedLessonsUseCase } from './modules/lessons/application/useCases/countReviewedLessons'
import { ExportLessonProgressUseCase } from './modules/lessons/application/useCases/exportLessonProgress'
import { GetCompletedTracksUseCase } from './modules/lessons/application/useCases/getCompletedTracks'
import { FindLessonUnlockingKeyUseCase } from './modules/lessons/application/useCases/findLessonUnlockingKey'
import { GetLessonUseCase } from './modules/lessons/application/useCases/getLesson'
import { GetUnlockedProductKeysUseCase } from './modules/lessons/application/useCases/getUnlockedProductKeys'
import { HasCompletedLessonTodayUseCase } from './modules/lessons/application/useCases/hasCompletedLessonToday'
import { HasReviewedOldLessonTodayUseCase } from './modules/lessons/application/useCases/hasReviewedOldLessonToday'
import { HasMicroDecisionStreakTodayUseCase } from './modules/lessons/application/useCases/hasMicroDecisionStreakToday'
import { ReviewLessonUseCase } from './modules/lessons/application/useCases/reviewLesson'
import { GetTrackMapUseCase } from './modules/lessons/application/useCases/getTrackMap'
import { createInProcessStreakTracker } from './modules/lessons/infrastructure/gamification/inProcessStreakTracker'
import { createInProcessXpAwarder } from './modules/lessons/infrastructure/gamification/inProcessXpAwarder'
import { createDrizzleLessonRepository } from './modules/lessons/infrastructure/persistence/drizzleLessonRepository'
import { createInProcessSocialFeedRecorder } from './modules/lessons/infrastructure/socialfeed/inProcessSocialFeedRecorder'
import { createLessonsRouter } from './modules/lessons/interfaces/http/lessonsRouter'
import { RecordTrackCompletedUseCase } from './modules/socialfeed/application/useCases/recordTrackCompleted'
import { ListFeedForUserUseCase } from './modules/socialfeed/application/useCases/listFeedForUser'
import { createInProcessFriendGraphReader as createInProcessSocialFeedFriendGraphReader } from './modules/socialfeed/infrastructure/friendships/inProcessFriendGraphReader'
import { createDrizzleSocialFeedEventRepository } from './modules/socialfeed/infrastructure/persistence/drizzleSocialFeedEventRepository'
import { createDrizzleUserDirectory as createDrizzleSocialFeedUserDirectory } from './modules/socialfeed/infrastructure/persistence/drizzleUserDirectory'
import { createSocialFeedRouter } from './modules/socialfeed/interfaces/http/socialFeedRouter'
import { ExportFriendshipsUseCase } from './modules/friendships/application/useCases/exportFriendships'
import { ListFriendRequestsUseCase } from './modules/friendships/application/useCases/listFriendRequests'
import { ListFriendsUseCase } from './modules/friendships/application/useCases/listFriends'
import { RemoveFriendshipUseCase } from './modules/friendships/application/useCases/removeFriendship'
import { RespondToFriendRequestUseCase } from './modules/friendships/application/useCases/respondToFriendRequest'
import { SearchUsersUseCase } from './modules/friendships/application/useCases/searchUsers'
import { SendFriendRequestUseCase } from './modules/friendships/application/useCases/sendFriendRequest'
import { createDrizzleFriendshipRepository } from './modules/friendships/infrastructure/persistence/drizzleFriendshipRepository'
import { createDrizzleUserDirectory as createDrizzleFriendshipUserDirectory } from './modules/friendships/infrastructure/persistence/drizzleUserDirectory'
import { createFriendshipsRouter } from './modules/friendships/interfaces/http/friendshipsRouter'
import { CompleteMissionUseCase } from './modules/missions/application/useCases/completeMission'
import { ExportMissionProgressUseCase } from './modules/missions/application/useCases/exportMissionProgress'
import { ListDailyMissionsUseCase } from './modules/missions/application/useCases/listDailyMissions'
import { createInProcessStreakTracker as createInProcessStreakTrackerForMissions } from './modules/missions/infrastructure/gamification/inProcessStreakTracker'
import { createInProcessXpAwarder as createInProcessXpAwarderForMissions } from './modules/missions/infrastructure/gamification/inProcessXpAwarder'
import { createInProcessLessonCompletionChecker } from './modules/missions/infrastructure/lessons/inProcessLessonCompletionChecker'
import { createInProcessLessonReviewChecker } from './modules/missions/infrastructure/lessons/inProcessLessonReviewChecker'
import { createInProcessMicroDecisionStreakChecker } from './modules/missions/infrastructure/lessons/inProcessMicroDecisionStreakChecker'
import { createDrizzleMissionRepository } from './modules/missions/infrastructure/persistence/drizzleMissionRepository'
import { createMissionsRouter } from './modules/missions/interfaces/http/missionsRouter'
import { GetNetWorthUseCase } from './modules/ranking/application/useCases/getNetWorth'
import { GetRankingUseCase } from './modules/ranking/application/useCases/getRanking'
import { createEngineAccountEventsReader } from './modules/ranking/infrastructure/engine/engineAccountEventsReader'
import { createEngineAssetPriceHistoryReader } from './modules/ranking/infrastructure/engine/engineAssetPriceHistoryReader'
import { createEngineCurrentAccountStateReader } from './modules/ranking/infrastructure/engine/engineCurrentAccountStateReader'
import { createEngineSandboxAssetReader } from './modules/ranking/infrastructure/engine/engineSandboxAssetReader'
import { createInProcessFriendGraphReader } from './modules/ranking/infrastructure/friendships/inProcessFriendGraphReader'
import { createInProcessLevelReader } from './modules/ranking/infrastructure/gamification/inProcessLevelReader'
import { createDrizzleUserDirectory } from './modules/ranking/infrastructure/persistence/drizzleUserDirectory'
import { createRedisNetWorthCache } from './modules/ranking/infrastructure/cache/redisNetWorthCache'
import { createRedisNetWorthCacheStore } from './modules/ranking/infrastructure/cache/redisNetWorthCacheStore'
import { createRankingRouter } from './modules/ranking/interfaces/http/rankingRouter'
import { GetPublicProfileUseCase } from './modules/profile/application/useCases/getPublicProfile'
import { createInProcessAchievementsReader } from './modules/profile/infrastructure/achievements/inProcessAchievementsReader'
import { createInProcessGamificationReader } from './modules/profile/infrastructure/gamification/inProcessGamificationReader'
import { createDrizzleUserDirectory as createDrizzleProfileUserDirectory } from './modules/profile/infrastructure/persistence/drizzleUserDirectory'
import { createInProcessProfitabilityReader } from './modules/profile/infrastructure/ranking/inProcessProfitabilityReader'
import { createInProcessTrackCompletionReader } from './modules/profile/infrastructure/lessons/inProcessTrackCompletionReader'
import { createProfileRouter } from './modules/profile/interfaces/http/profileRouter'
import type { GoogleIdentityProvider } from './modules/auth/application/ports/googleIdentityProvider'
import type { TokenIssuer } from './modules/auth/application/ports/tokenIssuer'
import type { UserRepository } from './modules/auth/application/ports/userRepository'
import { AnonymizeAccountUseCase } from './modules/auth/application/useCases/anonymizeAccount'
import { ChangePasswordUseCase } from './modules/auth/application/useCases/changePassword'
import { ExportUserDataUseCase } from './modules/auth/application/useCases/exportUserData'
import { GetCurrentUserUseCase } from './modules/auth/application/useCases/getCurrentUser'
import { ListIdentitiesUseCase } from './modules/auth/application/useCases/listIdentities'
import { LoginUserUseCase } from './modules/auth/application/useCases/loginUser'
import { LoginWithGoogleUseCase } from './modules/auth/application/useCases/loginWithGoogle'
import { RegisterUserUseCase } from './modules/auth/application/useCases/registerUser'
import { UpdateProfileUseCase } from './modules/auth/application/useCases/updateProfile'
import { UploadAvatarUseCase } from './modules/auth/application/useCases/uploadAvatar'
import { createInProcessAchievementsExporter } from './modules/auth/infrastructure/achievements/inProcessAchievementsExporter'
import { createEngineAccountProvisioner } from './modules/auth/infrastructure/engine/engineAccountProvisioner'
import { createInProcessFriendshipsExporter } from './modules/auth/infrastructure/friendships/inProcessFriendshipsExporter'
import { createInProcessProgressionExporter } from './modules/auth/infrastructure/gamification/inProcessProgressionExporter'
import {
  createDisabledGoogleIdentityProvider,
  createGoogleIdentityProvider,
} from './modules/auth/infrastructure/google/googleIdentityProviderAdapter'
import { createInProcessLessonProgressExporter } from './modules/auth/infrastructure/lessons/inProcessLessonProgressExporter'
import { createInProcessMissionProgressExporter } from './modules/auth/infrastructure/missions/inProcessMissionProgressExporter'
import { createDrizzleUserRepository } from './modules/auth/infrastructure/persistence/drizzleUserRepository'
import { createBcryptPasswordHasher } from './modules/auth/infrastructure/security/bcryptPasswordHasher'
import { createJwtTokenIssuer } from './modules/auth/infrastructure/security/jwtTokenIssuer'
import { createDiskAvatarStorage } from './modules/auth/infrastructure/storage/diskAvatarStorage'
import { createAccountRouter } from './modules/auth/interfaces/http/accountRouter'
import { createAuthRouter } from './modules/auth/interfaces/http/authRouter'
import { GetAssetQuotesUseCase } from './modules/market/application/useCases/getAssetQuotes'
import { GetAssetBookUseCase } from './modules/market/application/useCases/getAssetBook'
import { GetAssetUseCase } from './modules/market/application/useCases/getAsset'
import { CancelOrderUseCase } from './modules/market/application/useCases/cancelOrder'
import { GetCompanyUseCase } from './modules/market/application/useCases/getCompany'
import { GetMyAccountUseCase } from './modules/market/application/useCases/getMyAccount'
import { ListAssetsUseCase } from './modules/market/application/useCases/listAssets'
import { ListMyEventsUseCase } from './modules/market/application/useCases/listMyEvents'
import { ListMyOrdersUseCase } from './modules/market/application/useCases/listMyOrders'
import { PlaceOrderUseCase } from './modules/market/application/useCases/placeOrder'
import { PurchaseFixedIncomeUseCase } from './modules/market/application/useCases/purchaseFixedIncome'
import { RedeemFixedIncomeUseCase } from './modules/market/application/useCases/redeemFixedIncome'
import { SimulateFixedIncomeUseCase } from './modules/market/application/useCases/simulateFixedIncome'
import { GetFixedIncomeTaxRateUseCase } from './modules/market/application/useCases/getFixedIncomeTaxRate'
import { GetIndicatorHistoryUseCase } from './modules/market/application/useCases/getIndicatorHistory'
import { GetMarketCalendarUseCase } from './modules/market/application/useCases/getMarketCalendar'
import { GetMarketClockUseCase } from './modules/market/application/useCases/getMarketClock'
import { GetTradingHaltsUseCase } from './modules/market/application/useCases/getTradingHalts'
import { createEngineMarketCalendarReader } from './modules/market/infrastructure/engine/engineMarketCalendarReader'
import { createEngineAccountReader } from './modules/market/infrastructure/engine/engineAccountReader'
import { createEngineCatalogReader } from './modules/market/infrastructure/engine/engineCatalogReader'
import { createEngineIndicatorHistoryReader } from './modules/market/infrastructure/engine/engineIndicatorHistoryReader'
import { createRedisIndicatorHistoryCache } from './modules/market/infrastructure/cache/redisIndicatorHistoryCache'
import { createRedisIndicatorHistoryCacheStore } from './modules/market/infrastructure/cache/redisIndicatorHistoryCacheStore'
import { createEngineFixedIncomeExecutor } from './modules/market/infrastructure/engine/engineFixedIncomeExecutor'
import { createEngineOrderExecutor } from './modules/market/infrastructure/engine/engineOrderExecutor'
import { createInProcessProductUnlockReader } from './modules/market/infrastructure/lessons/inProcessProductUnlockReader'
import { createMarketRouter } from './modules/market/interfaces/http/marketRouter'
import { createAuthMiddleware } from './shared/http/authMiddleware'
import { noStore } from './shared/http/noStore'
import { createRateLimiter } from './shared/http/rateLimit'
import { ReauthenticateUseCase } from './modules/auth/application/useCases/reauthenticate'
import { createAuditLogAdminSessionAuditor } from './modules/admin/infrastructure/audit/auditLogAdminSessionAuditor'

export interface AppDeps {
  userRepository?: UserRepository
  tokenIssuer?: TokenIssuer
  googleIdentityProvider?: GoogleIdentityProvider
}

function resolveGoogleIdentityProvider(): GoogleIdentityProvider {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (clientId && clientSecret && redirectUri) {
    return createGoogleIdentityProvider({ clientId, clientSecret, redirectUri })
  }
  return createDisabledGoogleIdentityProvider()
}

// Composição (raiz de injeção de dependência): aqui, e só aqui, decidimos
// quais adapters concretos entram atrás de cada porta. Módulos (domain,
// application) nunca importam infrastructure diretamente — ver
// .claude/arquitetura-backend-ddd-lite.md.
export function createApp(deps: AppDeps = {}): Express {
  // Testes de rotas que não tocam o banco (health/status) podem chamar
  // createApp() sem argumentos — o Pool só conecta no primeiro uso. Uma
  // única `Database`/Pool é compartilhada por todos os repositórios Drizzle
  // do banco `gamification` (um schema só, ver .claude/arquitetura-backend-ddd-lite.md).
  const db = createDb(process.env.DATABASE_URL ?? 'postgres://unconfigured')
  // Mesmo comportamento "conecta só no primeiro uso" do Pool acima
  // (createRedisClient usa lazyConnect) — tarefa 5.7, primeira consumidora
  // real de REDIS_URL no backend.
  const redisClient = createRedisClient(process.env.REDIS_URL ?? 'redis://localhost:6379')
  const userRepository = deps.userRepository ?? createDrizzleUserRepository(db)
  // Fallback só cobre createApp() sem args (ex: health/status.test.ts); em
  // qualquer ambiente real, JWT_SECRET vem do .env (docker-compose.yml já
  // define um default de dev).
  const tokenIssuer =
    deps.tokenIssuer ??
    createJwtTokenIssuer(process.env.JWT_SECRET ?? 'dev-secret-troque-em-producao')
  const googleIdentityProvider = deps.googleIdentityProvider ?? resolveGoogleIdentityProvider()
  const passwordHasher = createBcryptPasswordHasher()
  const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8080'
  const accountProvisioner = createEngineAccountProvisioner(engineUrl)
  const macroEventTrigger = createEngineMacroEventTrigger(engineUrl)
  const macroEventReader = createEngineMacroEventReader(engineUrl)
  const tickTrigger = createEngineTickTrigger(engineUrl)

  // `lessonRepository` precisa existir antes do módulo `market` abaixo —
  // é o dado-fonte do gate de desbloqueio (`productUnlockReader`, 7.0.1).
  const lessonRepository = createDrizzleLessonRepository(db)

  // Módulo `market` (tarefa 6.0.3) — proxy fino de leitura/escrita do
  // motor, autenticação à parte (o motor não conhece usuário). Não
  // reaproveita `getNetWorth`/os readers do ranking abaixo — ver
  // .docs/backend/market.md e o comentário em getMyAccount.ts.
  const catalogReader = createEngineCatalogReader(engineUrl)
  const accountReader = createEngineAccountReader(engineUrl)
  const orderExecutor = createEngineOrderExecutor(engineUrl)
  const fixedIncomeExecutor = createEngineFixedIncomeExecutor(engineUrl)
  // Gate real de desbloqueio por lição (tarefa 7.0.1, achado 5) — adapter em
  // processo sobre `modules/lessons`, mesmo padrão de
  // `inProcessLessonCompletionChecker` (missions, 5.4).
  const productUnlockReader = createInProcessProductUnlockReader(
    new GetUnlockedProductKeysUseCase(lessonRepository),
    new FindLessonUnlockingKeyUseCase(lessonRepository),
  )
  const listAssets = new ListAssetsUseCase(catalogReader)
  const getAsset = new GetAssetUseCase(catalogReader)
  const getAssetQuotes = new GetAssetQuotesUseCase(catalogReader)
  const getAssetBook = new GetAssetBookUseCase(catalogReader)
  const getCompany = new GetCompanyUseCase(catalogReader)
  const getMyAccount = new GetMyAccountUseCase(accountReader, catalogReader)
  const listMyEvents = new ListMyEventsUseCase(accountReader)
  const placeOrder = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)
  const cancelOrder = new CancelOrderUseCase(orderExecutor)
  const listMyOrders = new ListMyOrdersUseCase(orderExecutor, catalogReader)
  const purchaseFixedIncome = new PurchaseFixedIncomeUseCase(
    fixedIncomeExecutor,
    catalogReader,
    productUnlockReader,
  )
  const redeemFixedIncome = new RedeemFixedIncomeUseCase(fixedIncomeExecutor)
  const simulateFixedIncome = new SimulateFixedIncomeUseCase(fixedIncomeExecutor)
  const getFixedIncomeTaxRate = new GetFixedIncomeTaxRateUseCase(fixedIncomeExecutor)
  // Proxy com cache Redis (tarefa M.3) pra GET /market/indicators/history
  // do motor (tarefa M.2) — mesmo padrão de cache de leitura de
  // createRedisNetWorthCache abaixo, chave por `days` em vez de userId/asOf
  // (a série é a mesma pra qualquer chamador).
  const cachedIndicatorHistoryReader = createRedisIndicatorHistoryCache(
    createEngineIndicatorHistoryReader(engineUrl),
    createRedisIndicatorHistoryCacheStore(redisClient),
  )
  const getIndicatorHistory = new GetIndicatorHistoryUseCase(cachedIndicatorHistoryReader)
  const marketCalendarReader = createEngineMarketCalendarReader(engineUrl)
  const getMarketClock = new GetMarketClockUseCase(marketCalendarReader)
  const getMarketCalendar = new GetMarketCalendarUseCase(marketCalendarReader)
  const getTradingHalts = new GetTradingHaltsUseCase(marketCalendarReader)

  const registerUser = new RegisterUserUseCase(
    userRepository,
    passwordHasher,
    tokenIssuer,
    accountProvisioner,
  )
  const getCurrentUser = new GetCurrentUserUseCase(userRepository)
  const loginWithGoogle = new LoginWithGoogleUseCase(
    userRepository,
    googleIdentityProvider,
    tokenIssuer,
    accountProvisioner,
  )
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const auditLogRepository = createDrizzleAuditLogRepository(db)
  const adminSessionAuditor = createAuditLogAdminSessionAuditor(auditLogRepository)
  const loginUser = new LoginUserUseCase(
    userRepository,
    passwordHasher,
    tokenIssuer,
    adminSessionAuditor,
  )
  const reauthenticate = new ReauthenticateUseCase(
    userRepository,
    passwordHasher,
    tokenIssuer,
    adminSessionAuditor,
  )
  const recordAdminAction = new RecordAdminActionUseCase(auditLogRepository)
  const listAuditLog = new ListAuditLogUseCase(auditLogRepository)
  const triggerMacroEvent = new TriggerMacroEventUseCase(macroEventTrigger, recordAdminAction)
  const macroEventAdmin = createEngineMacroEventAdmin(engineUrl)
  const getMacroEventDetail = new GetMacroEventDetailUseCase(
    macroEventAdmin,
    createNewsUserViewProjector(),
  )
  const cancelMacroEvent = new CancelMacroEventUseCase(macroEventAdmin, recordAdminAction)
  const listMacroEvents = new ListMacroEventsUseCase(macroEventReader)
  const triggerTick = new TriggerTickUseCase(tickTrigger, recordAdminAction)
  const schedulerAdmin = createEngineSchedulerAdmin(engineUrl)
  const getSchedulerStatus = new GetSchedulerStatusUseCase(schedulerAdmin)
  const setSchedulerPaused = new SetSchedulerPausedUseCase(schedulerAdmin, recordAdminAction)
  const listTicks = new ListTicksUseCase(schedulerAdmin)
  const advanceTicks = new AdvanceTicksUseCase(schedulerAdmin, recordAdminAction)
  // Visão geral e saúde (N.5): só leitura. O banco "market" é sondado pela mesma
  // leitura da visão geral do motor (só o motor fala com ele).
  const marketOverviewReader = createEngineMarketOverviewReader(engineUrl)
  const getSystemHealth = new GetSystemHealthUseCase({
    engine: createEngineHealthProbe(engineUrl),
    gamification_db: createDatabaseProbe(db),
    market_db: createMarketDatabaseProbe(marketOverviewReader),
    redis: createRedisProbe(redisClient),
  })
  // Monitor do mercado (N.8): só leitura.
  const marketMonitorReader = createEngineMarketMonitorReader(engineUrl)
  const listMarketMonitor = new ListMarketMonitorUseCase(marketMonitorReader)
  const getMarketMonitorAsset = new GetMarketMonitorAssetUseCase(marketMonitorReader)
  // Ordens do painel (N.10): consulta e cancelamento por intervenção.
  const orderAdmin = createEngineOrderAdmin(engineUrl)
  const listAdminOrders = new ListAdminOrdersUseCase(orderAdmin)
  const cancelAdminOrder = new CancelAdminOrderUseCase(orderAdmin, recordAdminAction)
  const cancelAdminOrdersBatch = new CancelAdminOrdersBatchUseCase(orderAdmin, recordAdminAction)
  // Pausa de negociação (N.9).
  const tradingHaltAdmin = createEngineTradingHaltAdmin(engineUrl)
  const listTradingHalts = new ListTradingHaltsUseCase(tradingHaltAdmin)
  const pauseTrading = new PauseTradingUseCase(tradingHaltAdmin, recordAdminAction)
  const liftTradingHalt = new LiftTradingHaltUseCase(tradingHaltAdmin, recordAdminAction)
  const engineSettingsAdmin = createEngineSettingsAdmin(engineUrl)
  const listEngineSettings = new ListEngineSettingsUseCase(engineSettingsAdmin)
  const updateEngineSetting = new UpdateEngineSettingUseCase(engineSettingsAdmin, recordAdminAction)
  const resetEngineSetting = new ResetEngineSettingUseCase(engineSettingsAdmin, recordAdminAction)
  // Gestão de bots (N.1).
  const botAdmin = createEngineBotAdmin(engineUrl)
  const listAdminBots = new ListAdminBotsUseCase(botAdmin)
  const createAdminBot = new CreateAdminBotUseCase(botAdmin, recordAdminAction)
  const updateAdminBot = new UpdateAdminBotUseCase(botAdmin, recordAdminAction)
  const fundAdminBot = new FundAdminBotUseCase(botAdmin, recordAdminAction)
  // Desempenho dos bots (N.14).
  const getAdminBotActivity = new GetAdminBotActivityUseCase(botAdmin)
  const getAdminBotsSummary = new GetAdminBotsSummaryUseCase(botAdmin)
  const getAdminOverview = new GetAdminOverviewUseCase(
    marketOverviewReader,
    schedulerAdmin,
    createDrizzleUserStatsReader(db),
  )
  // Reaproveita a mesma instância de ListMacroEventsUseCase (admin, 4.5) —
  // feed público (6.0.6, tela 5.1) é o mesmo caso de uso, só sem
  // requireRole('admin') no router. newsReadRepository (6.6.2) decora
  // `seen` por usuário — tabela própria do módulo, não vem do motor.
  const newsReadRepository = createDrizzleNewsReadRepository(db)
  const listNewsFeed = new ListNewsFeedUseCase(
    createInProcessNewsFeedReader(listMacroEvents),
    newsReadRepository,
  )
  const markNewsEventAsSeen = new MarkNewsEventAsSeenUseCase(newsReadRepository)
  const progressionRepository = createDrizzleProgressionRepository(db)
  const getProgression = new GetProgressionUseCase(progressionRepository)
  const monthlySalaryReader = createInProcessMonthlySalaryReader()
  const countCompletedLessons = new CountCompletedLessonsUseCase(lessonRepository)
  const getCurrentMicroDecisionStreak = new GetCurrentMicroDecisionStreakUseCase(lessonRepository)
  const getTracksCompletedWithoutErrorsCount = new GetTracksCompletedWithoutErrorsCountUseCase(
    lessonRepository,
  )
  const countReviewedLessons = new CountReviewedLessonsUseCase(lessonRepository)

  // Readers de patrimônio/ranking (5.5) — precisam existir antes de
  // `achievements` (5.2), que os consome pros critérios `net_worth`/
  // `trades_executed`. Reaproveitados de novo mais abaixo por `getRanking`.
  const userDirectory = createDrizzleUserDirectory(db)
  const sandboxAssetReader = createEngineSandboxAssetReader(engineUrl)
  const getNetWorth = new GetNetWorthUseCase(
    createEngineAccountEventsReader(engineUrl),
    createEngineAssetPriceHistoryReader(engineUrl),
    createEngineCurrentAccountStateReader(engineUrl),
  )

  const achievementRepository = createDrizzleAchievementRepository(db)
  const progressSnapshotReader = createInProcessProgressSnapshotReader({
    getProgression,
    countCompletedLessons,
    getCurrentMicroDecisionStreak,
    getTracksCompletedWithoutErrorsCount,
    countReviewedLessons,
    getNetWorth,
    sandboxAssetReader,
  })
  const checkAndUnlockAchievements = new CheckAndUnlockAchievementsUseCase(
    achievementRepository,
    progressSnapshotReader,
  )
  const listAchievements = new ListAchievementsUseCase(
    achievementRepository,
    progressSnapshotReader,
  )
  const achievementChecker = createInProcessAchievementChecker(checkAndUnlockAchievements)

  const awardXp = new AwardXpUseCase(progressionRepository, achievementChecker)
  const touchStreak = new TouchStreakUseCase(progressionRepository, achievementChecker)

  const xpAwarder = createInProcessXpAwarder(awardXp)
  const streakTracker = createInProcessStreakTracker(touchStreak)

  // `friendshipRepository` precisa existir aqui (antes do bloco de amizades
  // abaixo) porque o feed social (G.1), consumido por `advanceLesson`
  // logo a seguir, também lê o grafo de amigos.
  const friendshipRepository = createDrizzleFriendshipRepository(db)
  const socialFeedEventRepository = createDrizzleSocialFeedEventRepository(db)
  const recordTrackCompleted = new RecordTrackCompletedUseCase(socialFeedEventRepository)
  const listFeedForUser = new ListFeedForUserUseCase(
    createInProcessSocialFeedFriendGraphReader(friendshipRepository),
    socialFeedEventRepository,
    createDrizzleSocialFeedUserDirectory(db),
  )

  // Tempo mínimo entre avanços de passo de lição (S.4); env inválida ou
  // negativa cai no padrão em vez de desligar o gate sem querer.
  const configuredStepInterval = Number(process.env.LESSON_MIN_STEP_INTERVAL_MS || Number.NaN)
  const lessonMinStepIntervalMs =
    Number.isFinite(configuredStepInterval) && configuredStepInterval >= 0
      ? configuredStepInterval
      : LESSON_MIN_STEP_INTERVAL_MS
  const getTrackMap = new GetTrackMapUseCase(lessonRepository)
  const getLesson = new GetLessonUseCase(lessonRepository)
  const advanceLesson = new AdvanceLessonUseCase(
    lessonRepository,
    xpAwarder,
    streakTracker,
    createInProcessSocialFeedRecorder(recordTrackCompleted),
    { minStepIntervalMs: lessonMinStepIntervalMs },
  )
  const reviewLesson = new ReviewLessonUseCase(
    lessonRepository,
    createInProcessAchievementCheckerForLessons(checkAndUnlockAchievements),
  )
  const hasCompletedLessonToday = new HasCompletedLessonTodayUseCase(lessonRepository)
  const hasReviewedOldLessonToday = new HasReviewedOldLessonTodayUseCase(lessonRepository)
  const hasMicroDecisionStreakToday = new HasMicroDecisionStreakTodayUseCase(lessonRepository)

  const missionRepository = createDrizzleMissionRepository(db)
  const listDailyMissions = new ListDailyMissionsUseCase(missionRepository)
  const completeMission = new CompleteMissionUseCase(
    missionRepository,
    createInProcessLessonCompletionChecker(hasCompletedLessonToday),
    createInProcessLessonReviewChecker(hasReviewedOldLessonToday),
    createInProcessMicroDecisionStreakChecker(hasMicroDecisionStreakToday),
    createInProcessXpAwarderForMissions(awardXp),
    createInProcessStreakTrackerForMissions(touchStreak),
  )

  const friendshipUserDirectory = createDrizzleFriendshipUserDirectory(db)
  const searchUsers = new SearchUsersUseCase(friendshipUserDirectory)
  const sendFriendRequest = new SendFriendRequestUseCase(
    friendshipRepository,
    friendshipUserDirectory,
  )
  const respondToFriendRequest = new RespondToFriendRequestUseCase(friendshipRepository)
  const removeFriendship = new RemoveFriendshipUseCase(friendshipRepository)
  const listFriends = new ListFriendsUseCase(friendshipRepository, friendshipUserDirectory)
  const listFriendRequests = new ListFriendRequestsUseCase(
    friendshipRepository,
    friendshipUserDirectory,
  )

  // Cache de leitura (tarefa 5.7) só pra GetRankingUseCase — decora a
  // mesma port NetWorthReader que achievements/profile usam sem cache
  // (createInProcessProgressSnapshotReader/inProcessProfitabilityReader,
  // acima), pra não atrasar o desbloqueio "instantâneo" de conquista já
  // validado na 5.2 nem servir rentabilidade defasada no perfil público.
  // Escopo Amigos (5.9) reaproveita as mesmas entradas de cache por
  // usuário que o escopo Global já populou (chave por userId/asOf, não por
  // window/scope — ver redisNetWorthCache.ts), então nunca precisa de
  // cache próprio.
  const cachedNetWorthForRanking = createRedisNetWorthCache(
    getNetWorth,
    createRedisNetWorthCacheStore(redisClient),
  )
  const getRanking = new GetRankingUseCase(
    userDirectory,
    sandboxAssetReader,
    cachedNetWorthForRanking,
    createInProcessLevelReader(getProgression),
    createInProcessFriendGraphReader(friendshipRepository),
  )

  const getPublicProfile = new GetPublicProfileUseCase(
    createDrizzleProfileUserDirectory(db),
    createInProcessGamificationReader(getProgression),
    createInProcessAchievementsReader(listAchievements),
    createInProcessProfitabilityReader(getNetWorth, sandboxAssetReader),
    createInProcessTrackCompletionReader(new GetCompletedTracksUseCase(lessonRepository)),
  )

  const updateProfile = new UpdateProfileUseCase(userRepository)
  const changePassword = new ChangePasswordUseCase(userRepository, passwordHasher)
  const listIdentities = new ListIdentitiesUseCase(userRepository)
  // Tarefa 6.10.8 — volume Docker persistente (docker-compose.yml), servido
  // de volta por `express.static('/avatars', ...)` logo abaixo.
  const avatarStorageDir = process.env.AVATAR_STORAGE_DIR ?? '/data/avatars'
  const avatarStorage = createDiskAvatarStorage(avatarStorageDir)
  const uploadAvatar = new UploadAvatarUseCase(userRepository, avatarStorage)
  const anonymizeAccount = new AnonymizeAccountUseCase(userRepository, avatarStorage)
  const exportUserData = new ExportUserDataUseCase(
    userRepository,
    createInProcessProgressionExporter(getProgression),
    createInProcessLessonProgressExporter(new ExportLessonProgressUseCase(lessonRepository)),
    createInProcessAchievementsExporter(
      new ExportUnlockedAchievementsUseCase(achievementRepository),
    ),
    createInProcessFriendshipsExporter(new ExportFriendshipsUseCase(friendshipRepository)),
    createInProcessMissionProgressExporter(new ExportMissionProgressUseCase(missionRepository)),
  )

  // Sem isso, o build de produção do frontend (vite build + preview, ou
  // qualquer hospedagem estática — CLAUDE.md proíbe container pro
  // frontend) fala com o gateway a partir de uma origem diferente, e o
  // navegador bloqueia a resposta. Em dev, o proxy do Vite (vite.config.ts,
  // tarefa 6.0.1) já torna a chamada same-origin, então isso não é
  // observável rodando só `npm run dev` — só em `vite build && vite preview`.
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const app = express()
  // Atrás do gateway nginx (um salto): sem isso `req.ip` seria sempre o IP do
  // gateway e o limitador de taxa (N.22) trataria todo mundo como um cliente só.
  app.set('trust proxy', 1)
  app.use(cors({ origin: frontendUrl }))
  app.use(express.json())
  app.use(healthRouter)
  app.use(statusRouter)
  // Serve os arquivos salvos por `UploadAvatarUseCase`/`diskAvatarStorage`
  // (tarefa 6.10.8) — mesma pasta do volume Docker, montado na raiz do
  // gateway (`location /` já faz proxy de tudo, `gateway/nginx.conf`).
  app.use('/avatars', express.static(avatarStorageDir))
  // Conferência de senha é alvo de força bruta: teto bem menor que o do painel.
  app.use('/auth/reauth', createRateLimiter({ windowMs: 5 * 60_000, max: 10 }))
  app.use(
    createAuthRouter({
      registerUser,
      loginUser,
      getCurrentUser,
      loginWithGoogle,
      reauthenticate,
      googleIdentityProvider,
      authMiddleware,
    }),
  )
  app.use(
    createAccountRouter({
      updateProfile,
      changePassword,
      listIdentities,
      exportUserData,
      anonymizeAccount,
      uploadAvatar,
      authMiddleware,
    }),
  )
  // N.22: respostas do painel nunca em cache e teto de requisições por IP
  // (o painel faz polling, então o teto é folgado; freia laço descontrolado).
  app.use('/admin', noStore, createRateLimiter({ windowMs: 60_000, max: 600 }))
  app.use(createAdminPingRouter(authMiddleware))
  app.use(
    createAdminMacroEventsRouter({
      triggerMacroEvent,
      listMacroEvents,
      getMacroEventDetail,
      cancelMacroEvent,
      authMiddleware,
    }),
  )
  app.use(createAdminTickRouter({ triggerTick, authMiddleware }))
  app.use(
    createAdminSchedulerRouter({
      getSchedulerStatus,
      setSchedulerPaused,
      listTicks,
      advanceTicks,
      authMiddleware,
    }),
  )
  app.use(createAdminSystemRouter({ getSystemHealth, getAdminOverview, authMiddleware }))
  app.use(createAdminMarketRouter({ listMarketMonitor, getMarketMonitorAsset, authMiddleware }))
  app.use(
    createAdminHaltsRouter({ listTradingHalts, pauseTrading, liftTradingHalt, authMiddleware }),
    createAdminSettingsRouter({
      listEngineSettings,
      updateEngineSetting,
      resetEngineSetting,
      authMiddleware,
    }),
  )
  app.use(
    createAdminBotsRouter({
      listAdminBots,
      createAdminBot,
      updateAdminBot,
      fundAdminBot,
      getAdminBotActivity,
      getAdminBotsSummary,
      authMiddleware,
    }),
  )
  app.use(
    createAdminOrdersRouter({
      listAdminOrders,
      cancelAdminOrder,
      cancelAdminOrdersBatch,
      authMiddleware,
    }),
  )
  app.use(createAdminAuditLogRouter({ listAuditLog, authMiddleware }))
  app.use(createNewsRouter({ listNewsFeed, markNewsEventAsSeen, authMiddleware }))
  app.use(createProgressionRouter({ getProgression, monthlySalaryReader, authMiddleware }))
  app.use(createStreakRouter({ getProgression, authMiddleware }))
  app.use(
    createLessonsRouter({ getTrackMap, getLesson, advanceLesson, reviewLesson, authMiddleware }),
  )
  app.use(createRankingRouter({ getRanking, authMiddleware }))
  app.use(createMissionsRouter({ listDailyMissions, completeMission, authMiddleware }))
  app.use(createAchievementsRouter({ listAchievements, authMiddleware }))
  app.use(createProfileRouter({ getPublicProfile, authMiddleware }))
  app.use(createSocialFeedRouter({ listFeedForUser, authMiddleware }))
  app.use(
    createMarketRouter({
      listAssets,
      getAsset,
      getAssetQuotes,
      getAssetBook,
      getCompany,
      getMyAccount,
      listMyEvents,
      placeOrder,
      cancelOrder,
      listMyOrders,
      purchaseFixedIncome,
      redeemFixedIncome,
      simulateFixedIncome,
      getFixedIncomeTaxRate,
      getIndicatorHistory,
      getMarketClock,
      getMarketCalendar,
      getTradingHalts,
      authMiddleware,
    }),
  )
  app.use(
    createFriendshipsRouter({
      searchUsers,
      sendFriendRequest,
      respondToFriendRequest,
      removeFriendship,
      listFriends,
      listFriendRequests,
      authMiddleware,
    }),
  )
  app.use(jsonErrorHandler)
  return app
}
