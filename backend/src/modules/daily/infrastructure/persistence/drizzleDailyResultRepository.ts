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

    async update(userId, puzzleNumber, now, apply) {
      return db.transaction(async (tx) => {
        await tx
          .insert(dailyResults)
          .values({ userId, puzzleNumber, startedAt: now })
          .onConflictDoNothing({ target: [dailyResults.userId, dailyResults.puzzleNumber] })
        // Trava a linha até o fim da transação: a segunda aba espera e já enxerga o que a primeira gravou.
        const [row] = await tx
          .select()
          .from(dailyResults)
          .where(and(eq(dailyResults.userId, userId), eq(dailyResults.puzzleNumber, puzzleNumber)))
          .for('update')
        const { next, value } = apply(toResult(row))
        await tx
          .update(dailyResults)
          .set({
            wordGuesses: next.wordGuesses,
            wordCorrect: next.wordCorrect,
            questionChoice: next.questionChoice,
            questionCorrect: next.questionCorrect,
            timelineOrder: next.timelineOrder,
            timelineCorrect: next.timelineCorrect,
            xpAwarded: next.xpAwarded,
            completedAt: next.completedAt,
          })
          .where(eq(dailyResults.id, row.id))
        return { result: next, value }
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
