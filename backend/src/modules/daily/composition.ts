import type { Database } from '../../db/client'
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

// Composição do Diário: a única peça que instancia os adapters concretos. Cresce a cada tarefa
// (login, XP e streak na DI.2.2, painel na DI.5.1).
export function createDailyComposition(db: Database) {
  const settings = createDrizzleDailySettingsRepository(db)
  const words = createDrizzleDailyWordRepository(db)
  const questions = createDrizzleDailyQuestionRepository(db)
  const events = createDrizzleDailyEventRepository(db)
  const puzzles = createDrizzleDailyPuzzleRepository(db)

  const materializeUpcomingPuzzles = new MaterializeUpcomingPuzzlesUseCase(
    settings,
    words,
    questions,
    events,
    puzzles,
  )

  const acceptedWords = createDrizzleAcceptedWordRepository(db)
  const loader = new DailyGameLoader(settings, puzzles, words, questions, events)
  const router = createDailyRouter({
    getToday: new GetTodayUseCase(settings, loader),
    getGame: new GetGameUseCase(loader),
    evaluateWordGuess: new EvaluateWordGuessUseCase(loader, acceptedWords),
    answerTrivia: new AnswerTriviaUseCase(loader),
    answerTimeline: new AnswerTimelineUseCase(loader),
  })

  return { materializeUpcomingPuzzles, router }
}
