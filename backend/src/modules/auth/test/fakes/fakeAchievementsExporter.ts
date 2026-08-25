import type {
  AchievementsExporter,
  ExportedAchievement,
} from '../../application/ports/achievementsExporter'

export function createFakeAchievementsExporter(
  byUserId: Record<string, ExportedAchievement[]> = {},
): AchievementsExporter {
  return {
    async exportForUser(userId) {
      return byUserId[userId] ?? []
    },
  }
}
