import type { StreakTracker } from '../../application/ports/streakTracker'

export interface FakeStreakTracker extends StreakTracker {
  touchedUserIds: string[]
}

export function createFakeStreakTracker(): FakeStreakTracker {
  const touchedUserIds: string[] = []
  return {
    touchedUserIds,
    async touch(userId) {
      touchedUserIds.push(userId)
    },
  }
}
