import type { LessonCompletionChecker } from '../../application/ports/lessonCompletionChecker'

export function createFakeLessonCompletionChecker(hasCompleted = false): LessonCompletionChecker {
  return {
    async hasCompletedLessonToday() {
      return hasCompleted
    },
  }
}
