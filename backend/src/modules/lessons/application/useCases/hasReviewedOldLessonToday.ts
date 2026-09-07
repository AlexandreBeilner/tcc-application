import { isEligibleForReview, utcDateString } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface HasReviewedOldLessonTodayInput {
  userId: string
}

// Consumida em processo pelo módulo `missions` (H.2) — a missão "revise uma
// lição antiga" é a segunda com verificação cruzada real contra
// `user_lesson_progress` (a primeira foi `HasCompletedLessonTodayUseCase`,
// 5.4). Só conta lição concluída há pelo menos
// `REVIEW_ELIGIBLE_AFTER_DAYS` — reabrir algo concluído ontem não conta.
export class HasReviewedOldLessonTodayUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: HasReviewedOldLessonTodayInput): Promise<boolean> {
    const now = new Date()
    const today = utcDateString(now)
    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    return progress.some(
      (p) =>
        p.completedAt !== null &&
        p.lastReviewedAt !== null &&
        utcDateString(p.lastReviewedAt) === today &&
        isEligibleForReview(p.completedAt, now),
    )
  }
}
