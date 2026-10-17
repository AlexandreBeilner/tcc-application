import { eq, inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyEvents } from '../../../../db/schema'
import type { DailyEventRepository } from '../../application/ports/dailyEventRepository'
import type { ContentScope, DailyEvent } from '../../domain/content'
import { learnMoreColumns, toLearnMore } from './learnMore'

function toEvent(row: typeof dailyEvents.$inferSelect): DailyEvent {
  return {
    id: row.id,
    stableKey: row.stableKey,
    year: row.year,
    label: row.label,
    explanation: row.explanation,
    sourceRef: row.sourceRef,
    learnMore: toLearnMore(row.learnMoreKind, row.learnMoreRef),
    category: row.category,
    scope: row.scope as ContentScope,
    reviewedAt: row.reviewedAt,
    active: row.active,
  }
}

export function createDrizzleDailyEventRepository(db: Database): DailyEventRepository {
  return {
    async create(event) {
      const [row] = await db
        .insert(dailyEvents)
        .values({
          stableKey: event.stableKey,
          year: event.year,
          label: event.label,
          explanation: event.explanation,
          sourceRef: event.sourceRef,
          ...learnMoreColumns(event.learnMore),
          category: event.category,
          scope: event.scope,
          reviewedAt: event.reviewedAt,
          active: event.active,
        })
        .returning()
      return toEvent(row)
    },

    async findById(id) {
      const [row] = await db.select().from(dailyEvents).where(eq(dailyEvents.id, id)).limit(1)
      return row ? toEvent(row) : null
    },

    async findManyByIds(ids) {
      if (ids.length === 0) return []
      const rows = await db
        .select()
        .from(dailyEvents)
        .where(inArray(dailyEvents.id, [...ids]))
      return rows.map(toEvent)
    },

    async listActive() {
      const rows = await db
        .select()
        .from(dailyEvents)
        .where(eq(dailyEvents.active, true))
        .orderBy(dailyEvents.stableKey)
      return rows.map(toEvent)
    },

    async listAll() {
      const rows = await db.select().from(dailyEvents).orderBy(dailyEvents.stableKey)
      return rows.map(toEvent)
    },

    async update(id, fields, updatedBy) {
      const { learnMore, ...rest } = fields
      const [row] = await db
        .update(dailyEvents)
        .set({
          ...rest,
          ...(learnMore !== undefined ? learnMoreColumns(learnMore) : {}),
          // Editar tira a revisão, a menos que o painel diga o contrário.
          ...(fields.reviewedAt === undefined ? { reviewedAt: null, reviewedBy: null } : {}),
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(dailyEvents.id, id))
        .returning()
      return row ? toEvent(row) : null
    },

    async markReviewed(ids, reviewedBy, now) {
      if (ids.length === 0) return
      await db
        .update(dailyEvents)
        .set({ reviewedBy, reviewedAt: now })
        .where(inArray(dailyEvents.id, [...ids]))
    },
  }
}
