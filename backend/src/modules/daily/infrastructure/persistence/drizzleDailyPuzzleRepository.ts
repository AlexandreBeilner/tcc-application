import { and, asc, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyPuzzles } from '../../../../db/schema'
import type { DailyPuzzleRepository } from '../../application/ports/dailyPuzzleRepository'
import type { CardOrigin, DailyPuzzle } from '../../domain/content'

function toPuzzle(row: typeof dailyPuzzles.$inferSelect): DailyPuzzle {
  return {
    number: row.number,
    gameDate: row.gameDate,
    wordId: row.wordId,
    questionId: row.questionId,
    timelineEventIds: row.timelineEventIds,
    wordOrigin: row.wordOrigin as CardOrigin,
    questionOrigin: row.questionOrigin as CardOrigin,
    timelineOrigin: row.timelineOrigin as CardOrigin,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
  }
}

export function createDrizzleDailyPuzzleRepository(db: Database): DailyPuzzleRepository {
  return {
    async create(puzzle) {
      await db.insert(dailyPuzzles).values({
        number: puzzle.number,
        gameDate: puzzle.gameDate,
        wordId: puzzle.wordId,
        questionId: puzzle.questionId,
        timelineEventIds: puzzle.timelineEventIds,
        wordOrigin: puzzle.wordOrigin,
        questionOrigin: puzzle.questionOrigin,
        timelineOrigin: puzzle.timelineOrigin,
        reviewedBy: puzzle.reviewedBy,
        reviewedAt: puzzle.reviewedAt,
        publishedAt: puzzle.publishedAt,
      })
    },

    async findByNumber(number) {
      const [row] = await db
        .select()
        .from(dailyPuzzles)
        .where(eq(dailyPuzzles.number, number))
        .limit(1)
      return row ? toPuzzle(row) : null
    },

    async findByDate(gameDate) {
      const [row] = await db
        .select()
        .from(dailyPuzzles)
        .where(eq(dailyPuzzles.gameDate, gameDate))
        .limit(1)
      return row ? toPuzzle(row) : null
    },

    async listFromDate(fromDate, limit) {
      const rows = await db
        .select()
        .from(dailyPuzzles)
        .where(gte(dailyPuzzles.gameDate, fromDate))
        .orderBy(asc(dailyPuzzles.gameDate))
        .limit(limit)
      return rows.map(toPuzzle)
    },

    async listUsing(kind, itemId) {
      const where =
        kind === 'word'
          ? eq(dailyPuzzles.wordId, itemId)
          : kind === 'question'
            ? eq(dailyPuzzles.questionId, itemId)
            : sql`${dailyPuzzles.timelineEventIds} @> ${JSON.stringify([itemId])}::jsonb`
      const rows = await db
        .select()
        .from(dailyPuzzles)
        .where(where)
        .orderBy(asc(dailyPuzzles.gameDate))
      return rows.map(toPuzzle)
    },

    async updateCard(number, change) {
      const set =
        change.card === 'word'
          ? { wordId: change.wordId, wordOrigin: 'manual' }
          : change.card === 'question'
            ? { questionId: change.questionId, questionOrigin: 'manual' }
            : { timelineEventIds: change.timelineEventIds, timelineOrigin: 'manual' }
      await db.update(dailyPuzzles).set(set).where(eq(dailyPuzzles.number, number))
    },

    async publishPending(fromDate, now) {
      const rows = await db
        .update(dailyPuzzles)
        .set({ publishedAt: now })
        .where(and(gte(dailyPuzzles.gameDate, fromDate), isNull(dailyPuzzles.publishedAt)))
        .returning({ number: dailyPuzzles.number })
      return rows.map((r) => r.number).sort((a, b) => a - b)
    },

    async unpublishFrom(fromDate) {
      const rows = await db
        .update(dailyPuzzles)
        .set({ publishedAt: null })
        .where(and(gte(dailyPuzzles.gameDate, fromDate), isNotNull(dailyPuzzles.publishedAt)))
        .returning({ number: dailyPuzzles.number })
      return rows.length
    },

    async markPublished(number, now) {
      await db.update(dailyPuzzles).set({ publishedAt: now }).where(eq(dailyPuzzles.number, number))
    },

    async replaceUnpublished(puzzles) {
      await db.transaction(async (tx) => {
        await tx.delete(dailyPuzzles).where(isNull(dailyPuzzles.publishedAt))
        if (puzzles.length === 0) return
        await tx.insert(dailyPuzzles).values(puzzles.map((p) => ({ ...p, publishedAt: null })))
      })
    },
  }
}
