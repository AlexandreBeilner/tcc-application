import cors from 'cors'
import express, { Express } from 'express'
import { createDb } from './db/client'
import { createRedisClient } from './infra/redisClient'
import { healthRouter } from './routes/health'
import { statusRouter } from './routes/status'
import { createEngineMacroEventTrigger } from './modules/admin/infrastructure/engine/engineMacroEventTrigger'
import { createEngineMacroEventReader } from './modules/admin/infrastructure/engine/engineMacroEventReader'
import { TriggerMacroEventUseCase } from './modules/admin/application/useCases/triggerMacroEvent'
import { ListMacroEventsUseCase } from './modules/admin/application/useCases/listMacroEvents'
import { createAdminMacroEventsRouter } from './modules/admin/interfaces/http/adminMacroEventsRouter'
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
import { createDrizzleProgressionRepository } from './modules/gamification/infrastructure/persistence/drizzleProgressionRepository'
import { createProgressionRouter } from './modules/gamification/interfaces/http/progressionRouter'
import { createStreakRouter } from './modules/gamification/interfaces/http/streakRouter'
import { AdvanceLessonUseCase } from './modules/lessons/application/useCases/advanceLesson'
import { CountCompletedLessonsUseCase } from './modules/lessons/application/useCases/countCompletedLessons'
import { ExportLessonProgressUseCase } from './modules/lessons/application/useCases/exportLessonProgress'
import { FindLessonUnlockingKeyUseCase } from './modules/lessons/application/useCases/findLessonUnlockingKey'
import { GetLessonUseCase } from './modules/lessons/application/useCases/getLesson'
import { GetUnlockedProductKeysUseCase } from './modules/lessons/application/useCases/getUnlockedProductKeys'
import { HasCompletedLessonTodayUseCase } from './modules/lessons/application/useCases/hasCompletedLessonToday'
import { HasReviewedOldLessonTodayUseCase } from './modules/lessons/application/useCases/hasReviewedOldLessonToday'
import { ReviewLessonUseCase } from './modules/lessons/application/useCases/reviewLesson'
import { GetTrackMapUseCase } from './modules/lessons/application/useCases/getTrackMap'
import { createInProcessStreakTracker } from './modules/lessons/infrastructure/gamification/inProcessStreakTracker'
import { createInProcessXpAwarder } from './modules/lessons/infrastructure/gamification/inProcessXpAwarder'
import { createDrizzleLessonRepository } from './modules/lessons/infrastructure/persistence/drizzleLessonRepository'
import { createLessonsRouter } from './modules/lessons/interfaces/http/lessonsRouter'
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
import { GetAssetUseCase } from './modules/market/application/useCases/getAsset'
import { GetCompanyUseCase } from './modules/market/application/useCases/getCompany'
import { GetMyAccountUseCase } from './modules/market/application/useCases/getMyAccount'
import { ListAssetsUseCase } from './modules/market/application/useCases/listAssets'
import { ListMyEventsUseCase } from './modules/market/application/useCases/listMyEvents'
import { PlaceOrderUseCase } from './modules/market/application/useCases/placeOrder'
import { PurchaseFixedIncomeUseCase } from './modules/market/application/useCases/purchaseFixedIncome'
import { RedeemFixedIncomeUseCase } from './modules/market/application/useCases/redeemFixedIncome'
import { SimulateFixedIncomeUseCase } from './modules/market/application/useCases/simulateFixedIncome'
import { GetFixedIncomeTaxRateUseCase } from './modules/market/application/useCases/getFixedIncomeTaxRate'
import { createEngineAccountReader } from './modules/market/infrastructure/engine/engineAccountReader'
import { createEngineCatalogReader } from './modules/market/infrastructure/engine/engineCatalogReader'
import { createEngineFixedIncomeExecutor } from './modules/market/infrastructure/engine/engineFixedIncomeExecutor'
import { createEngineOrderExecutor } from './modules/market/infrastructure/engine/engineOrderExecutor'
import { createInProcessProductUnlockReader } from './modules/market/infrastructure/lessons/inProcessProductUnlockReader'
import { createMarketRouter } from './modules/market/interfaces/http/marketRouter'
import { createAuthMiddleware } from './shared/http/authMiddleware'

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
  const getCompany = new GetCompanyUseCase(catalogReader)
  const getMyAccount = new GetMyAccountUseCase(accountReader)
  const listMyEvents = new ListMyEventsUseCase(accountReader)
  const placeOrder = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)
  const purchaseFixedIncome = new PurchaseFixedIncomeUseCase(
    fixedIncomeExecutor,
    catalogReader,
    productUnlockReader,
  )
  const redeemFixedIncome = new RedeemFixedIncomeUseCase(fixedIncomeExecutor)
  const simulateFixedIncome = new SimulateFixedIncomeUseCase(fixedIncomeExecutor)
  const getFixedIncomeTaxRate = new GetFixedIncomeTaxRateUseCase(fixedIncomeExecutor)

  const registerUser = new RegisterUserUseCase(
    userRepository,
    passwordHasher,
    tokenIssuer,
    accountProvisioner,
  )
  const loginUser = new LoginUserUseCase(userRepository, passwordHasher, tokenIssuer)
  const getCurrentUser = new GetCurrentUserUseCase(userRepository)
  const loginWithGoogle = new LoginWithGoogleUseCase(
    userRepository,
    googleIdentityProvider,
    tokenIssuer,
    accountProvisioner,
  )
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const triggerMacroEvent = new TriggerMacroEventUseCase(macroEventTrigger)
  const listMacroEvents = new ListMacroEventsUseCase(macroEventReader)
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
  const countCompletedLessons = new CountCompletedLessonsUseCase(lessonRepository)

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
  const getTrackMap = new GetTrackMapUseCase(lessonRepository)
  const getLesson = new GetLessonUseCase(lessonRepository)
  const advanceLesson = new AdvanceLessonUseCase(lessonRepository, xpAwarder, streakTracker)
  const reviewLesson = new ReviewLessonUseCase(lessonRepository)
  const hasCompletedLessonToday = new HasCompletedLessonTodayUseCase(lessonRepository)
  const hasReviewedOldLessonToday = new HasReviewedOldLessonTodayUseCase(lessonRepository)

  const missionRepository = createDrizzleMissionRepository(db)
  const listDailyMissions = new ListDailyMissionsUseCase(missionRepository)
  const completeMission = new CompleteMissionUseCase(
    missionRepository,
    createInProcessLessonCompletionChecker(hasCompletedLessonToday),
    createInProcessLessonReviewChecker(hasReviewedOldLessonToday),
    createInProcessXpAwarderForMissions(awardXp),
    createInProcessStreakTrackerForMissions(touchStreak),
  )

  const friendshipRepository = createDrizzleFriendshipRepository(db)
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
  app.use(cors({ origin: frontendUrl }))
  app.use(express.json())
  app.use(healthRouter)
  app.use(statusRouter)
  // Serve os arquivos salvos por `UploadAvatarUseCase`/`diskAvatarStorage`
  // (tarefa 6.10.8) — mesma pasta do volume Docker, montado na raiz do
  // gateway (`location /` já faz proxy de tudo, `gateway/nginx.conf`).
  app.use('/avatars', express.static(avatarStorageDir))
  app.use(
    createAuthRouter({
      registerUser,
      loginUser,
      getCurrentUser,
      loginWithGoogle,
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
  app.use(createAdminPingRouter(authMiddleware))
  app.use(createAdminMacroEventsRouter({ triggerMacroEvent, listMacroEvents, authMiddleware }))
  app.use(createNewsRouter({ listNewsFeed, markNewsEventAsSeen, authMiddleware }))
  app.use(createProgressionRouter({ getProgression, authMiddleware }))
  app.use(createStreakRouter({ getProgression, authMiddleware }))
  app.use(
    createLessonsRouter({ getTrackMap, getLesson, advanceLesson, reviewLesson, authMiddleware }),
  )
  app.use(createRankingRouter({ getRanking, authMiddleware }))
  app.use(createMissionsRouter({ listDailyMissions, completeMission, authMiddleware }))
  app.use(createAchievementsRouter({ listAchievements, authMiddleware }))
  app.use(createProfileRouter({ getPublicProfile, authMiddleware }))
  app.use(
    createMarketRouter({
      listAssets,
      getAsset,
      getAssetQuotes,
      getCompany,
      getMyAccount,
      listMyEvents,
      placeOrder,
      purchaseFixedIncome,
      redeemFixedIncome,
      simulateFixedIncome,
      getFixedIncomeTaxRate,
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
  return app
}
