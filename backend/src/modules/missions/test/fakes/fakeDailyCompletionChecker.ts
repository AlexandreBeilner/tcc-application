import type { DailyCompletionChecker } from '../../application/ports/dailyCompletionChecker'

export function createFakeDailyCompletionChecker(completed = false): DailyCompletionChecker {
  return {
    async hasCompletedDailyToday() {
      return completed
    },
  }
}
