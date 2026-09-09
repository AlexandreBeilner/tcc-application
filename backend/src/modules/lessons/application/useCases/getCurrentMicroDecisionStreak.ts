import {
  buildMicroDecisionAttemptsChronological,
  currentMicroDecisionStreak,
} from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface GetCurrentMicroDecisionStreakInput {
  userId: string
}

// Consumida em processo pelo módulo `achievements` (backlog engajamento
// H.1) — critério `micro_decisions_streak`.
export class GetCurrentMicroDecisionStreakUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: GetCurrentMicroDecisionStreakInput): Promise<number> {
    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])

    const attempts = buildMicroDecisionAttemptsChronological(lessons, progress)

    return currentMicroDecisionStreak(attempts)
  }
}
