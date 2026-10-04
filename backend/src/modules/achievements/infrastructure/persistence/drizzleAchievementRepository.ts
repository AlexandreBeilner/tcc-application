import { and, eq } from 'drizzle-orm'
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
  }
}

export function createDrizzleAchievementRepository(db: Database): AchievementRepository {
  return {
    async listCatalog() {
      const rows = await db.select().from(achievements)
      return rows.map(toAchievement)
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

    async revoke(userId, achievementId) {
      const removed = await db
        .delete(userAchievements)
        .where(
          and(
            eq(userAchievements.userId, userId),
            eq(userAchievements.achievementId, achievementId),
          ),
        )
        .returning({ id: userAchievements.achievementId })
      return removed.length > 0
    },
  }
}
