import type {
  AchievementRepository,
  UnlockedAchievementRecord,
} from '../../application/ports/achievementRepository'
import type { Achievement } from '../../domain/achievement'

export function createFakeAchievementRepository(
  seedCatalog: Achievement[] = [],
): AchievementRepository {
  const catalog = [...seedCatalog]
  const unlocked = new Map<string, UnlockedAchievementRecord[]>()

  return {
    async listCatalog() {
      return [...catalog]
    },

    async listUnlockedForUser(userId) {
      return [...(unlocked.get(userId) ?? [])]
    },

    async unlock(userId, achievementId) {
      const existing = unlocked.get(userId) ?? []
      if (existing.some((u) => u.achievementId === achievementId)) {
        return
      }
      unlocked.set(userId, [...existing, { achievementId, unlockedAt: new Date() }])
    },
  }
}
