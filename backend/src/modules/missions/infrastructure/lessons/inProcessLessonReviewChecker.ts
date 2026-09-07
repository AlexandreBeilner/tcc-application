import type { HasReviewedOldLessonTodayUseCase } from '../../../lessons/application/useCases/hasReviewedOldLessonToday'
import type { LessonReviewChecker } from '../../application/ports/lessonReviewChecker'

export function createInProcessLessonReviewChecker(
  hasReviewedOldLessonToday: HasReviewedOldLessonTodayUseCase,
): LessonReviewChecker {
  return {
    async hasReviewedOldLessonToday(userId) {
      return hasReviewedOldLessonToday.execute({ userId })
    },
  }
}
