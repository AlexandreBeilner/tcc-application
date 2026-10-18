import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyWords } from '../../../../db/schema'
import type { DailyWordRepository } from '../../application/ports/dailyWordRepository'
import type { ContentScope, DailyWord } from '../../domain/content'
import { learnMoreColumns, toLearnMore } from './learnMore'

function toWord(row: typeof dailyWords.$inferSelect): DailyWord {
  return {
    id: row.id,
    stableKey: row.stableKey,
    answer: row.answer,
    display: row.display,
    definition: row.definition,
    learnMore: toLearnMore(row.learnMoreKind, row.learnMoreRef),
    category: row.category,
    scope: row.scope as ContentScope,
    active: row.active,
  }
}

export function createDrizzleDailyWordRepository(db: Database): DailyWordRepository {
  return {
    async create(word) {
      const [row] = await db
        .insert(dailyWords)
        .values({
          stableKey: word.stableKey,
          answer: word.answer,
          display: word.display,
          definition: word.definition,
          ...learnMoreColumns(word.learnMore),
          category: word.category,
          scope: word.scope,
          active: word.active,
        })
        .returning()
      return toWord(row)
    },

    async findById(id) {
      const [row] = await db.select().from(dailyWords).where(eq(dailyWords.id, id)).limit(1)
      return row ? toWord(row) : null
    },

    async listActive() {
      const rows = await db
        .select()
        .from(dailyWords)
        .where(eq(dailyWords.active, true))
        .orderBy(dailyWords.stableKey)
      return rows.map(toWord)
    },

    async listAll() {
      const rows = await db.select().from(dailyWords).orderBy(dailyWords.stableKey)
      return rows.map(toWord)
    },

    async update(id, fields, updatedBy) {
      const { learnMore, ...rest } = fields
      const [row] = await db
        .update(dailyWords)
        .set({
          ...rest,
          ...(learnMore !== undefined ? learnMoreColumns(learnMore) : {}),
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(dailyWords.id, id))
        .returning()
      return row ? toWord(row) : null
    },
  }
}
