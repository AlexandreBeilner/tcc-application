import type {
  AchievementChecker,
  UnlockedAchievement,
} from '../../application/ports/achievementChecker'

export function createFakeAchievementChecker(
  nextResult: UnlockedAchievement[] = [],
): AchievementChecker & { calls: string[]; nextResult: UnlockedAchievement[] } {
  const calls: string[] = []
  const fake = {
    calls,
    nextResult,
    async checkAndUnlock(userId: string) {
      calls.push(userId)
      return fake.nextResult
    },
  }
  return fake
}
