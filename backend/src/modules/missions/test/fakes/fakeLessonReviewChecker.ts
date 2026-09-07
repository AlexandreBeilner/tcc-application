import type { LessonReviewChecker } from '../../application/ports/lessonReviewChecker'

export function createFakeLessonReviewChecker(hasReviewed = false): LessonReviewChecker {
  return {
    async hasReviewedOldLessonToday() {
      return hasReviewed
    },
  }
}
