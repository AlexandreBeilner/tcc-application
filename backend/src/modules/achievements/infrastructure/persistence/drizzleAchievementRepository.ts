import { count, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { achievements, userAchievements } from '../../../../db/schema'
import type { AchievementRepository } from '../../application/ports/achievementRepository'
import type { Achievement } from '../../domain/achievement'

function toAchievement(row: typeof achievements.$inferSelect): Achievement {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    criteriaType: row.criteriaType,
    // Drizzle mapeia `numeric` pra string (evita perda de precisão) —
    // convertido aqui, único lugar que sabe do formato físico da coluna.
    criteriaValue: Number(row.criteriaValue),
    isActive: row.isActive,
    isRare: row.isRare,
  }
}

export function createDrizzleAchievementRepository(db: Database): AchievementRepository {
  return {
    async listCatalog() {
      const rows = await db.select().from(achievements)
      return rows.map(toAchievement)
    },

    async findById(id) {
      const [row] = await db.select().from(achievements).where(eq(achievements.id, id)).limit(1)
      return row ? toAchievement(row) : undefined
    },

    async create(draft) {
      const [row] = await db
        .insert(achievements)
        .values({
          name: draft.name,
          description: draft.description,
          criteriaType: draft.criteriaType,
          criteriaValue: String(draft.criteriaValue),
        })
        .returning()
      return toAchievement(row)
    },

    async update(id, patch) {
      const set: Partial<typeof achievements.$inferInsert> = {}
      if (patch.name !== undefined) set.name = patch.name
      if (patch.description !== undefined) set.description = patch.description
      if (patch.criteriaType !== undefined) set.criteriaType = patch.criteriaType
      if (patch.criteriaValue !== undefined) set.criteriaValue = String(patch.criteriaValue)
      if (patch.isActive !== undefined) set.isActive = patch.isActive
      if (patch.isRare !== undefined) set.isRare = patch.isRare
      if (Object.keys(set).length === 0) {
        const [current] = await db
          .select()
          .from(achievements)
          .where(eq(achievements.id, id))
          .limit(1)
        return current ? toAchievement(current) : undefined
      }
      const [row] = await db
        .update(achievements)
        .set(set)
        .where(eq(achievements.id, id))
        .returning()
      return row ? toAchievement(row) : undefined
    },

    async countUnlockedByAchievement() {
      const rows = await db
        .select({ achievementId: userAchievements.achievementId, total: count() })
        .from(userAchievements)
        .groupBy(userAchievements.achievementId)
      return new Map(rows.map((row) => [row.achievementId, Number(row.total)]))
    },

    async listUnlockedForUser(userId) {
      const rows = await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId))
      return rows.map((row) => ({ achievementId: row.achievementId, unlockedAt: row.unlockedAt }))
    },

    async unlock(userId, achievementId) {
      await db
        .insert(userAchievements)
        .values({ userId, achievementId })
        .onConflictDoNothing({
          target: [userAchievements.userId, userAchievements.achievementId],
        })
    },
  }
}
