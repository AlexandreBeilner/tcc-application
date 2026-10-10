import { desc, inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { socialFeedEvents } from '../../../../db/schema'
import type { DuelFeedData, SocialFeedEvent, SocialFeedEventType } from '../../domain/socialFeedEvent'
import type { SocialFeedEventRepository } from '../../application/ports/socialFeedEventRepository'

function toEvent(row: typeof socialFeedEvents.$inferSelect): SocialFeedEvent {
  return {
    id: row.id,
    userId: row.userId,
    // Coluna é texto livre no schema (permite tipo futuro sem migration) —
    // o cast pro union fechado do domínio fica aqui, na borda de leitura.
    type: row.type as SocialFeedEventType,
    trackNumber: row.trackNumber,
    data: (row.data as DuelFeedData | null) ?? null,
    occurredAt: row.occurredAt,
  }
}

export function createDrizzleSocialFeedEventRepository(db: Database): SocialFeedEventRepository {
  return {
    async record(userId, type, trackNumber, data) {
      await db.insert(socialFeedEvents).values({ userId, type, trackNumber, data: data ?? null })
    },

    async listForUsers(userIds, limit) {
      if (userIds.length === 0) {
        return []
      }
      const rows = await db
        .select()
        .from(socialFeedEvents)
        .where(inArray(socialFeedEvents.userId, userIds))
        .orderBy(desc(socialFeedEvents.occurredAt))
        .limit(limit)
      return rows.map(toEvent)
    },
  }
}
