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

    async findById(id) {
      return catalog.find((a) => a.id === id)
    },

    async create(draft) {
      const created: Achievement = { id: `ach-${catalog.length + 1}`, isActive: true, ...draft }
      catalog.push(created)
      return created
    },

    async update(id, patch) {
      const index = catalog.findIndex((a) => a.id === id)
      if (index < 0) return undefined
      const merged = { ...catalog[index] }
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) Object.assign(merged, { [key]: value })
      }
      catalog[index] = merged
      return merged
    },

    async countUnlockedByAchievement() {
      const counts = new Map<string, number>()
      for (const records of unlocked.values()) {
        for (const record of records) {
          counts.set(record.achievementId, (counts.get(record.achievementId) ?? 0) + 1)
        }
      }
      return counts
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
