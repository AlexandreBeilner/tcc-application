import type { AchievementChecker } from '../../application/ports/achievementChecker'

export function createFakeAchievementChecker(): AchievementChecker & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async checkAndUnlock(userId) {
      calls.push(userId)
    },
  }
}
