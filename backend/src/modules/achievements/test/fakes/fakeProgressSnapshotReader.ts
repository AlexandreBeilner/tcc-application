import type { ProgressSnapshot } from '../../domain/achievement'
import type { ProgressSnapshotReader } from '../../application/ports/progressSnapshotReader'

const ZERO_SNAPSHOT: ProgressSnapshot = {
  netWorth: 0,
  streakDays: 0,
  lessonsCompleted: 0,
  tradesExecuted: 0,
  microDecisionsStreak: 0,
  tracksCompletedNoErrors: 0,
  lessonsReviewed: 0,
}

export function createFakeProgressSnapshotReader(
  snapshotsByUserId: Record<string, ProgressSnapshot> = {},
): ProgressSnapshotReader {
  return {
    async getSnapshot(userId) {
      return snapshotsByUserId[userId] ?? ZERO_SNAPSHOT
    },
  }
}
