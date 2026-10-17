import { and, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyResults } from '../../../../db/schema'
import type { DailyResultRepository } from '../../application/ports/dailyResultRepository'
import type { DailyResult } from '../../domain/content'

function toResult(row: typeof dailyResults.$inferSelect): DailyResult {
  return {
    userId: row.userId,
    puzzleNumber: row.puzzleNumber,
    wordGuesses: row.wordGuesses,
    wordCorrect: row.wordCorrect,
    questionChoice: row.questionChoice,
    questionCorrect: row.questionCorrect,
    timelineOrder: row.timelineOrder,
    timelineCorrect: row.timelineCorrect,
    xpAwarded: row.xpAwarded,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  }
}

export function createDrizzleDailyResultRepository(db: Database): DailyResultRepository {
  return {
    async find(userId, puzzleNumber) {
      const [row] = await db
        .select()
        .from(dailyResults)
        .where(and(eq(dailyResults.userId, userId), eq(dailyResults.puzzleNumber, puzzleNumber)))
        .limit(1)
      return row ? toResult(row) : null
    },

    async save(result) {
      const values = {
        wordGuesses: result.wordGuesses,
        wordCorrect: result.wordCorrect,
        questionChoice: result.questionChoice,
        questionCorrect: result.questionCorrect,
        timelineOrder: result.timelineOrder,
        timelineCorrect: result.timelineCorrect,
        xpAwarded: result.xpAwarded,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
      }
      await db
        .insert(dailyResults)
        .values({ userId: result.userId, puzzleNumber: result.puzzleNumber, ...values })
        .onConflictDoUpdate({
          target: [dailyResults.userId, dailyResults.puzzleNumber],
          set: values,
        })
    },

    async listByUser(userId) {
      const rows = await db
        .select()
        .from(dailyResults)
        .where(eq(dailyResults.userId, userId))
        .orderBy(dailyResults.puzzleNumber)
      return rows.map(toResult)
    },
  }
}
