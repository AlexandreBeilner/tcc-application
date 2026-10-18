import type { HasCompletedDailyTodayUseCase } from '../../../daily/application/useCases/hasCompletedDailyToday'
import type { DailyCompletionChecker } from '../../application/ports/dailyCompletionChecker'

export function createInProcessDailyCompletionChecker(
  hasCompletedDailyToday: HasCompletedDailyTodayUseCase,
): DailyCompletionChecker {
  return {
    async hasCompletedDailyToday(userId) {
      return hasCompletedDailyToday.execute({ userId, now: new Date() })
    },
  }
}
