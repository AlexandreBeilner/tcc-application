import express, { Express } from 'express'
import { createDb } from './db/client'
import { healthRouter } from './routes/health'
import { statusRouter } from './routes/status'
import { createEngineMacroEventTrigger } from './modules/admin/infrastructure/engine/engineMacroEventTrigger'
import { createEngineMacroEventReader } from './modules/admin/infrastructure/engine/engineMacroEventReader'
import { TriggerMacroEventUseCase } from './modules/admin/application/useCases/triggerMacroEvent'
import { ListMacroEventsUseCase } from './modules/admin/application/useCases/listMacroEvents'
import { createAdminMacroEventsRouter } from './modules/admin/interfaces/http/adminMacroEventsRouter'
import { createAdminPingRouter } from './modules/admin/interfaces/http/pingRouter'
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
import { GetLessonUseCase } from './modules/lessons/application/useCases/getLesson'
import { HasCompletedLessonTodayUseCase } from './modules/lessons/application/useCases/hasCompletedLessonToday'
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
import { createAccountRouter } from './modules/auth/interfaces/http/accountRouter'
import { createAuthRouter } from './modules/auth/interfaces/http/authRouter'
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
  const progressionRepository = createDrizzleProgressionRepository(db)
  const getProgression = new GetProgressionUseCase(progressionRepository)
  const lessonRepository = createDrizzleLessonRepository(db)
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
  const hasCompletedLessonToday = new HasCompletedLessonTodayUseCase(lessonRepository)

  const missionRepository = createDrizzleMissionRepository(db)
  const listDailyMissions = new ListDailyMissionsUseCase(missionRepository)
  const completeMission = new CompleteMissionUseCase(
    missionRepository,
    createInProcessLessonCompletionChecker(hasCompletedLessonToday),
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

  const getRanking = new GetRankingUseCase(
    userDirectory,
    sandboxAssetReader,
    getNetWorth,
    createInProcessLevelReader(getProgression),
    createInProcessFriendGraphReader(listFriends),
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
  const anonymizeAccount = new AnonymizeAccountUseCase(userRepository)
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

  const app = express()
  app.use(express.json())
  app.use(healthRouter)
  app.use(statusRouter)
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
      authMiddleware,
    }),
  )
  app.use(createAdminPingRouter(authMiddleware))
  app.use(createAdminMacroEventsRouter({ triggerMacroEvent, listMacroEvents, authMiddleware }))
  app.use(createProgressionRouter({ getProgression, authMiddleware }))
  app.use(createStreakRouter({ getProgression, authMiddleware }))
  app.use(createLessonsRouter({ getTrackMap, getLesson, advanceLesson, authMiddleware }))
  app.use(createRankingRouter({ getRanking, authMiddleware }))
  app.use(createMissionsRouter({ listDailyMissions, completeMission, authMiddleware }))
  app.use(createAchievementsRouter({ listAchievements, authMiddleware }))
  app.use(createProfileRouter({ getPublicProfile, authMiddleware }))
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
