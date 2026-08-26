import type { HasCompletedLessonTodayUseCase } from '../../../lessons/application/useCases/hasCompletedLessonToday'
import type { LessonCompletionChecker } from '../../application/ports/lessonCompletionChecker'

export function createInProcessLessonCompletionChecker(
  hasCompletedLessonToday: HasCompletedLessonTodayUseCase,
): LessonCompletionChecker {
  return {
    async hasCompletedLessonToday(userId) {
      return hasCompletedLessonToday.execute({ userId })
    },
  }
}
