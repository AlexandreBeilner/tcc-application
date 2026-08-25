import type {
  AchievementsReader,
  UnlockedAchievementSummary,
} from '../../application/ports/achievementsReader'

export function createFakeAchievementsReader(
  unlockedByUserId: Record<string, UnlockedAchievementSummary[]> = {},
): AchievementsReader {
  return {
    async listUnlocked(userId) {
      return unlockedByUserId[userId] ?? []
    },
  }
}
