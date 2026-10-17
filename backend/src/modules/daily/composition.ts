import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import type { AwardXpUseCase } from '../gamification/application/useCases/awardXp'
import type { TouchStreakUseCase } from '../gamification/application/useCases/touchStreak'
import { DailyProgressRecorder } from './application/dailyProgressRecorder'
import { GetMyGameStateUseCase } from './application/useCases/getMyGameState'
import { GetMyStatsUseCase } from './application/useCases/getMyStats'
import { createInProcessStreakTracker } from './infrastructure/gamification/inProcessStreakTracker'
import { createInProcessXpAwarder } from './infrastructure/gamification/inProcessXpAwarder'
import { createDrizzleDailyResultRepository } from './infrastructure/persistence/drizzleDailyResultRepository'
import { DailyGameLoader } from './application/dailyGameLoader'
import { AnswerTimelineUseCase } from './application/useCases/answerTimeline'
import { AnswerTriviaUseCase } from './application/useCases/answerTrivia'
import { EvaluateWordGuessUseCase } from './application/useCases/evaluateWordGuess'
import { GetGameUseCase } from './application/useCases/getGame'
import { GetTodayUseCase } from './application/useCases/getToday'
import { MaterializeUpcomingPuzzlesUseCase } from './application/useCases/materializeUpcomingPuzzles'
import { createDailyRouter } from './interfaces/http/dailyRouter'
import { createDrizzleAcceptedWordRepository } from './infrastructure/persistence/drizzleAcceptedWordRepository'
import { createDrizzleDailyEventRepository } from './infrastructure/persistence/drizzleDailyEventRepository'
import { createDrizzleDailyPuzzleRepository } from './infrastructure/persistence/drizzleDailyPuzzleRepository'
import { createDrizzleDailyQuestionRepository } from './infrastructure/persistence/drizzleDailyQuestionRepository'
import { createDrizzleDailySettingsRepository } from './infrastructure/persistence/drizzleDailySettingsRepository'
import { createDrizzleDailyWordRepository } from './infrastructure/persistence/drizzleDailyWordRepository'

// Composição do Diário: a única peça que instancia os adapters concretos.

// Agenda (processo de fundo, `server.ts`): só precisa dos bancos de conteúdo.
export function createDailyAgendaComposition(db: Database) {
  const materializeUpcomingPuzzles = new MaterializeUpcomingPuzzlesUseCase(
    createDrizzleDailySettingsRepository(db),
    createDrizzleDailyWordRepository(db),
    createDrizzleDailyQuestionRepository(db),
    createDrizzleDailyEventRepository(db),
    createDrizzleDailyPuzzleRepository(db),
  )
  return { materializeUpcomingPuzzles }
}

export interface DailyRouterComposition {
  authMiddleware: AuthMiddleware
  // XP e streak entram pelos casos de uso de `gamification`, por ports próprias (padrão de `missions`).
  awardXp: AwardXpUseCase
  touchStreak: TouchStreakUseCase
}

// Rotas HTTP (`app.ts`). O painel (DI.5.1) entra aqui depois.
export function createDailyComposition(db: Database, deps: DailyRouterComposition) {
  const settings = createDrizzleDailySettingsRepository(db)
  const words = createDrizzleDailyWordRepository(db)
  const questions = createDrizzleDailyQuestionRepository(db)
  const events = createDrizzleDailyEventRepository(db)
  const puzzles = createDrizzleDailyPuzzleRepository(db)
  const results = createDrizzleDailyResultRepository(db)
  const acceptedWords = createDrizzleAcceptedWordRepository(db)

  const loader = new DailyGameLoader(settings, puzzles, words, questions, events)
  const recorder = new DailyProgressRecorder(
    results,
    createInProcessXpAwarder(deps.awardXp),
    createInProcessStreakTracker(deps.touchStreak),
  )
  const router = createDailyRouter({
    getToday: new GetTodayUseCase(settings, loader),
    getGame: new GetGameUseCase(loader),
    evaluateWordGuess: new EvaluateWordGuessUseCase(loader, acceptedWords, recorder),
    answerTrivia: new AnswerTriviaUseCase(loader, recorder),
    answerTimeline: new AnswerTimelineUseCase(loader, recorder),
    getMyGameState: new GetMyGameStateUseCase(loader, results),
    getMyStats: new GetMyStatsUseCase(settings, results),
    authMiddleware: deps.authMiddleware,
  })
  return { router }
}
