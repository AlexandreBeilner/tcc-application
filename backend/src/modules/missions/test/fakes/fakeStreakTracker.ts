import type { StreakTouchResult, StreakTracker } from '../../application/ports/streakTracker'

const DEFAULT_RESULT: StreakTouchResult = {
  currentStreak: 1,
  longestStreak: 1,
  milestoneReached: null,
  unlockedAchievements: [],
}

export interface FakeStreakTracker extends StreakTracker {
  touchedUserIds: string[]
  nextResult: StreakTouchResult
}

export function createFakeStreakTracker(
  nextResult: StreakTouchResult = DEFAULT_RESULT,
): FakeStreakTracker {
  const touchedUserIds: string[] = []
  const fake: FakeStreakTracker = {
    touchedUserIds,
    nextResult,
    async touch(userId) {
      touchedUserIds.push(userId)
      return fake.nextResult
    },
  }
  return fake
}
