import {
  buildMicroDecisionAttemptsChronological,
  currentMicroDecisionStreak,
  MICRO_DECISION_MISSION_STREAK_THRESHOLD,
  utcDateString,
} from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface HasMicroDecisionStreakTodayInput {
  userId: string
}

// Consumida em processo pelo módulo `missions` (backlog engajamento H.3) —
// missão "acerte 3 apostas seguidas hoje". Reaproveita a mesma sequência de
// acertos de `GetCurrentMicroDecisionStreakUseCase` (H.1), só que limitada
// aos attempts concluídos no dia corrente (UTC) antes de aplicar
// `currentMicroDecisionStreak` — um erro no meio do dia zera a sequência
// dali pra frente, e nada de ontem carrega pra hoje (attempts de outro dia
// nem entram no cálculo).
export class HasMicroDecisionStreakTodayUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: HasMicroDecisionStreakTodayInput): Promise<boolean> {
    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])

    const today = utcDateString(new Date())
    const attemptsToday = buildMicroDecisionAttemptsChronological(lessons, progress).filter(
      (attempt) => utcDateString(attempt.completedAt) === today,
    )

    return currentMicroDecisionStreak(attemptsToday) >= MICRO_DECISION_MISSION_STREAK_THRESHOLD
  }
}
