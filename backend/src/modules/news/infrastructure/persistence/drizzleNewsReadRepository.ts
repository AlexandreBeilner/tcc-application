import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { newsEventReads } from '../../../../db/schema'
import type { NewsReadRepository } from '../../application/ports/newsReadRepository'

export function createDrizzleNewsReadRepository(db: Database): NewsReadRepository {
  return {
    async listSeenEventIds(userId, macroEventIds) {
      if (macroEventIds.length === 0) {
        return new Set()
      }
      const rows = await db
        .select({ macroEventId: newsEventReads.macroEventId })
        .from(newsEventReads)
        .where(
          and(
            eq(newsEventReads.userId, userId),
            inArray(newsEventReads.macroEventId, macroEventIds),
          ),
        )
      return new Set(rows.map((row) => row.macroEventId))
    },

    async markAsSeen(userId, macroEventId) {
      await db
        .insert(newsEventReads)
        .values({ userId, macroEventId })
        .onConflictDoNothing({
          target: [newsEventReads.userId, newsEventReads.macroEventId],
        })
    },
  }
}
