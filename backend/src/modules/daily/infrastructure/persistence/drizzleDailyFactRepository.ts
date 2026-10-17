import { eq, inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyFacts } from '../../../../db/schema'
import type { DailyFactRepository } from '../../application/ports/dailyFactRepository'
import type { ContentScope, DailyFact } from '../../domain/content'
import { learnMoreColumns, toLearnMore } from './learnMore'

function toFact(row: typeof dailyFacts.$inferSelect): DailyFact {
  return {
    id: row.id,
    stableKey: row.stableKey,
    eventDate: row.eventDate,
    question: row.question,
    options: row.options,
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    timelineLabel: row.timelineLabel,
    sourceRef: row.sourceRef,
    learnMore: toLearnMore(row.learnMoreKind, row.learnMoreRef),
    category: row.category,
    scope: row.scope as ContentScope,
    reviewedAt: row.reviewedAt,
    active: row.active,
  }
}

export function createDrizzleDailyFactRepository(db: Database): DailyFactRepository {
  return {
    async create(fact) {
      const [row] = await db
        .insert(dailyFacts)
        .values({
          stableKey: fact.stableKey,
          eventDate: fact.eventDate,
          question: fact.question,
          options: fact.options,
          correctIndex: fact.correctIndex,
          explanation: fact.explanation,
          timelineLabel: fact.timelineLabel,
          sourceRef: fact.sourceRef,
          ...learnMoreColumns(fact.learnMore),
          category: fact.category,
          scope: fact.scope,
          reviewedAt: fact.reviewedAt,
          active: fact.active,
        })
        .returning()
      return toFact(row)
    },

    async findById(id) {
      const [row] = await db.select().from(dailyFacts).where(eq(dailyFacts.id, id)).limit(1)
      return row ? toFact(row) : null
    },

    async findManyByIds(ids) {
      if (ids.length === 0) return []
      const rows = await db
        .select()
        .from(dailyFacts)
        .where(inArray(dailyFacts.id, [...ids]))
      return rows.map(toFact)
    },

    async listActive() {
      const rows = await db
        .select()
        .from(dailyFacts)
        .where(eq(dailyFacts.active, true))
        .orderBy(dailyFacts.stableKey)
      return rows.map(toFact)
    },
  }
}
