import { and, eq, gte, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { lessonCardReach, userLessonCardProgress } from '../../../../db/schema'
import type { LessonCardReachRepository } from '../../application/ports/lessonCardReachRepository'

export function createDrizzleLessonCardReachRepository(db: Database): LessonCardReachRepository {
  return {
    async recordReach({ userId, lessonId, position, day }) {
      return db.transaction(async (tx) => {
        // Upsert condicionado: só avança a posição quando o cartão está além da gravada. O `WHERE`
        // do `DO UPDATE` roda sob lock da linha, então duas requisições concorrentes da mesma
        // pessoa não passam as duas.
        const advanced = await tx
          .insert(userLessonCardProgress)
          .values({
            userId,
            lessonId,
            furthestPhase: position.phase,
            furthestCard: position.cardIndex,
          })
          .onConflictDoUpdate({
            target: [userLessonCardProgress.userId, userLessonCardProgress.lessonId],
            set: {
              furthestPhase: position.phase,
              furthestCard: position.cardIndex,
              updatedAt: sql`now()`,
            },
            setWhere: sql`(${userLessonCardProgress.furthestPhase}, ${userLessonCardProgress.furthestCard}) < (${position.phase}::smallint, ${position.cardIndex}::smallint)`,
          })
          .returning({ userId: userLessonCardProgress.userId })
        if (advanced.length === 0) {
          return false
        }

        await tx
          .insert(lessonCardReach)
          .values({
            lessonId,
            phase: position.phase,
            cardIndex: position.cardIndex,
            day,
            reachedCount: 1,
          })
          .onConflictDoUpdate({
            target: [
              lessonCardReach.lessonId,
              lessonCardReach.phase,
              lessonCardReach.cardIndex,
              lessonCardReach.day,
            ],
            set: { reachedCount: sql`${lessonCardReach.reachedCount} + 1` },
          })
        return true
      })
    },

    async listReach(lessonId, sinceDay) {
      const rows = await db
        .select({
          phase: lessonCardReach.phase,
          cardIndex: lessonCardReach.cardIndex,
          reached: sql<number>`SUM(${lessonCardReach.reachedCount})::int`,
        })
        .from(lessonCardReach)
        .where(and(eq(lessonCardReach.lessonId, lessonId), gte(lessonCardReach.day, sinceDay)))
        .groupBy(lessonCardReach.phase, lessonCardReach.cardIndex)
      return rows
    },
  }
}
