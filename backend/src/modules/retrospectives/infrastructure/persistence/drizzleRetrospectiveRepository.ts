import { and, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { retrospectives } from '../../../../db/schema'
import type { RetrospectiveRepository } from '../../application/ports/retrospectiveRepository'
import type { RetrospectiveData } from '../../domain/retrospective'

export function createDrizzleRetrospectiveRepository(db: Database): RetrospectiveRepository {
  return {
    async find(userId, month) {
      const [row] = await db
        .select()
        .from(retrospectives)
        .where(and(eq(retrospectives.userId, userId), eq(retrospectives.month, month)))
        .limit(1)
      return row ? (row.data as RetrospectiveData) : null
    },

    async saveIfAbsent(userId, month, data) {
      await db.insert(retrospectives).values({ userId, month, data }).onConflictDoNothing()
      const [row] = await db
        .select()
        .from(retrospectives)
        .where(and(eq(retrospectives.userId, userId), eq(retrospectives.month, month)))
        .limit(1)
      return row.data as RetrospectiveData
    },

    async listUserIdsWith(month) {
      const rows = await db
        .select({ userId: retrospectives.userId })
        .from(retrospectives)
        .where(eq(retrospectives.month, month))
      return new Set(rows.map((r) => r.userId))
    },
  }
}
