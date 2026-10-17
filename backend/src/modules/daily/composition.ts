import type { Database } from '../../db/client'
import { MaterializeUpcomingPuzzlesUseCase } from './application/useCases/materializeUpcomingPuzzles'
import { createDrizzleDailyEventRepository } from './infrastructure/persistence/drizzleDailyEventRepository'
import { createDrizzleDailyPuzzleRepository } from './infrastructure/persistence/drizzleDailyPuzzleRepository'
import { createDrizzleDailyQuestionRepository } from './infrastructure/persistence/drizzleDailyQuestionRepository'
import { createDrizzleDailySettingsRepository } from './infrastructure/persistence/drizzleDailySettingsRepository'
import { createDrizzleDailyWordRepository } from './infrastructure/persistence/drizzleDailyWordRepository'

// Composição do Diário: a única peça que instancia os adapters concretos. Cresce a cada tarefa
// (rotas na DI.2.1, painel na DI.5.1); por ora só a agenda, que é processo de fundo.
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
  return { materializeUpcomingPuzzles }
}
