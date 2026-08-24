import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { userProgression } from '../../../../db/schema'
import type { ProgressionRepository } from '../../application/ports/progressionRepository'
import type { Progression } from '../../domain/progression'

function toDomain(row: typeof userProgression.$inferSelect): Progression {
  return {
    userId: row.userId,
    xp: row.xp,
    level: row.level,
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
    lastQualifyingActivityDate: row.lastQualifyingActivityDate,
  }
}

export function createDrizzleProgressionRepository(db: Database): ProgressionRepository {
  return {
    async findByUserId(userId) {
      const [row] = await db
        .select()
        .from(userProgression)
        .where(eq(userProgression.userId, userId))
        .limit(1)
      return row ? toDomain(row) : undefined
    },

    async upsert(progression: Progression) {
      const values = {
        userId: progression.userId,
        xp: progression.xp,
        level: progression.level,
        currentStreak: progression.currentStreak,
        longestStreak: progression.longestStreak,
        lastQualifyingActivityDate: progression.lastQualifyingActivityDate,
      }
      const [row] = await db
        .insert(userProgression)
        .values(values)
        .onConflictDoUpdate({
          target: userProgression.userId,
          set: { ...values, updatedAt: new Date() },
        })
        .returning()
      return toDomain(row)
    },
  }
}
