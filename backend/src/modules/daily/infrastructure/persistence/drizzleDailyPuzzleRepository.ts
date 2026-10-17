import { and, asc, eq, gte, isNull } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyPuzzles } from '../../../../db/schema'
import type { DailyPuzzleRepository } from '../../application/ports/dailyPuzzleRepository'
import type { CardOrigin, DailyPuzzle } from '../../domain/content'

function toPuzzle(row: typeof dailyPuzzles.$inferSelect): DailyPuzzle {
  return {
    number: row.number,
    gameDate: row.gameDate,
    wordId: row.wordId,
    factId: row.factId,
    timelineFactIds: row.timelineFactIds,
    wordOrigin: row.wordOrigin as CardOrigin,
    factOrigin: row.factOrigin as CardOrigin,
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
        factId: puzzle.factId,
        timelineFactIds: puzzle.timelineFactIds,
        wordOrigin: puzzle.wordOrigin,
        factOrigin: puzzle.factOrigin,
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

    async markReviewed(number, reviewedBy, now) {
      await db
        .update(dailyPuzzles)
        .set({ reviewedBy, reviewedAt: now })
        .where(eq(dailyPuzzles.number, number))
    },

    async markPublished(number, now) {
      await db.update(dailyPuzzles).set({ publishedAt: now }).where(eq(dailyPuzzles.number, number))
    },

    async deleteUnpublishedFromDate(fromDate) {
      const deleted = await db
        .delete(dailyPuzzles)
        .where(and(gte(dailyPuzzles.gameDate, fromDate), isNull(dailyPuzzles.publishedAt)))
        .returning({ number: dailyPuzzles.number })
      return deleted.length
    },
  }
}
