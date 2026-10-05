import type {
  AchievementChecker,
  UnlockedAchievement,
} from '../../application/ports/achievementChecker'

type FakeAchievementChecker = AchievementChecker & {
  calls: string[]
  nextResult: UnlockedAchievement[]
  // Quando definido, a checagem falha com este erro (cobre o "best-effort").
  failWith?: Error
}

export function createFakeAchievementChecker(
  nextResult: UnlockedAchievement[] = [],
): FakeAchievementChecker {
  const calls: string[] = []
  const fake: FakeAchievementChecker = {
    calls,
    nextResult,
    async checkAndUnlock(userId: string) {
      calls.push(userId)
      if (fake.failWith) throw fake.failWith
      return fake.nextResult
    },
  }
  return fake
}
