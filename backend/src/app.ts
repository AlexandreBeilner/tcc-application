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
import { AwardXpUseCase } from './modules/gamification/application/useCases/awardXp'
import { GetProgressionUseCase } from './modules/gamification/application/useCases/getProgression'
import { TouchStreakUseCase } from './modules/gamification/application/useCases/touchStreak'
import { createDrizzleProgressionRepository } from './modules/gamification/infrastructure/persistence/drizzleProgressionRepository'
import { createProgressionRouter } from './modules/gamification/interfaces/http/progressionRouter'
import { createStreakRouter } from './modules/gamification/interfaces/http/streakRouter'
import { AdvanceLessonUseCase } from './modules/lessons/application/useCases/advanceLesson'
import { GetLessonUseCase } from './modules/lessons/application/useCases/getLesson'
import { GetTrackMapUseCase } from './modules/lessons/application/useCases/getTrackMap'
import { createInProcessStreakTracker } from './modules/lessons/infrastructure/gamification/inProcessStreakTracker'
import { createInProcessXpAwarder } from './modules/lessons/infrastructure/gamification/inProcessXpAwarder'
import { createDrizzleLessonRepository } from './modules/lessons/infrastructure/persistence/drizzleLessonRepository'
import { createLessonsRouter } from './modules/lessons/interfaces/http/lessonsRouter'
import { GetNetWorthUseCase } from './modules/ranking/application/useCases/getNetWorth'
import { GetRankingUseCase } from './modules/ranking/application/useCases/getRanking'
import { createEngineAccountEventsReader } from './modules/ranking/infrastructure/engine/engineAccountEventsReader'
import { createEngineAssetPriceHistoryReader } from './modules/ranking/infrastructure/engine/engineAssetPriceHistoryReader'
import { createEngineCurrentAccountStateReader } from './modules/ranking/infrastructure/engine/engineCurrentAccountStateReader'
import { createEngineSandboxAssetReader } from './modules/ranking/infrastructure/engine/engineSandboxAssetReader'
import { createDrizzleUserDirectory } from './modules/ranking/infrastructure/persistence/drizzleUserDirectory'
import { createRankingRouter } from './modules/ranking/interfaces/http/rankingRouter'
import type { GoogleIdentityProvider } from './modules/auth/application/ports/googleIdentityProvider'
import type { TokenIssuer } from './modules/auth/application/ports/tokenIssuer'
import type { UserRepository } from './modules/auth/application/ports/userRepository'
import { GetCurrentUserUseCase } from './modules/auth/application/useCases/getCurrentUser'
import { LoginUserUseCase } from './modules/auth/application/useCases/loginUser'
import { LoginWithGoogleUseCase } from './modules/auth/application/useCases/loginWithGoogle'
import { RegisterUserUseCase } from './modules/auth/application/useCases/registerUser'
import { createEngineAccountProvisioner } from './modules/auth/infrastructure/engine/engineAccountProvisioner'
import {
  createDisabledGoogleIdentityProvider,
  createGoogleIdentityProvider,
} from './modules/auth/infrastructure/google/googleIdentityProviderAdapter'
import { createDrizzleUserRepository } from './modules/auth/infrastructure/persistence/drizzleUserRepository'
import { createBcryptPasswordHasher } from './modules/auth/infrastructure/security/bcryptPasswordHasher'
import { createJwtTokenIssuer } from './modules/auth/infrastructure/security/jwtTokenIssuer'
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
  const awardXp = new AwardXpUseCase(progressionRepository)
  const touchStreak = new TouchStreakUseCase(progressionRepository)

  const lessonRepository = createDrizzleLessonRepository(db)
  const xpAwarder = createInProcessXpAwarder(awardXp)
  const streakTracker = createInProcessStreakTracker(touchStreak)
  const getTrackMap = new GetTrackMapUseCase(lessonRepository)
  const getLesson = new GetLessonUseCase(lessonRepository)
  const advanceLesson = new AdvanceLessonUseCase(lessonRepository, xpAwarder, streakTracker)

  const userDirectory = createDrizzleUserDirectory(db)
  const sandboxAssetReader = createEngineSandboxAssetReader(engineUrl)
  const getNetWorth = new GetNetWorthUseCase(
    createEngineAccountEventsReader(engineUrl),
    createEngineAssetPriceHistoryReader(engineUrl),
    createEngineCurrentAccountStateReader(engineUrl),
  )
  const getRanking = new GetRankingUseCase(userDirectory, sandboxAssetReader, getNetWorth)

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
  app.use(createAdminPingRouter(authMiddleware))
  app.use(createAdminMacroEventsRouter({ triggerMacroEvent, listMacroEvents, authMiddleware }))
  app.use(createProgressionRouter({ getProgression, authMiddleware }))
  app.use(createStreakRouter({ getProgression, authMiddleware }))
  app.use(createLessonsRouter({ getTrackMap, getLesson, advanceLesson, authMiddleware }))
  app.use(createRankingRouter({ getRanking, authMiddleware }))
  return app
}
