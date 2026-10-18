import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { lessonPollVotes } from '../../../../db/schema'
import type { LessonPollRepository } from '../../application/ports/lessonPollRepository'

export function createDrizzleLessonPollRepository(db: Database): LessonPollRepository {
  return {
    async castVote({ userId, lessonId, pollId, option }) {
      // `DO NOTHING` + leitura: o primeiro voto vale, e duas requisições concorrentes da mesma pessoa
      // terminam as duas devolvendo a opção que ficou gravada.
      await db
        .insert(lessonPollVotes)
        .values({ userId, lessonId, pollId, option })
        .onConflictDoNothing()
      const [row] = await db
        .select({ option: lessonPollVotes.option })
        .from(lessonPollVotes)
        .where(
          and(
            eq(lessonPollVotes.userId, userId),
            eq(lessonPollVotes.lessonId, lessonId),
            eq(lessonPollVotes.pollId, pollId),
          ),
        )
      return (row as { option: number }).option
    },

    async listVotesForUser(userId, lessonId) {
      return db
        .select({ pollId: lessonPollVotes.pollId, option: lessonPollVotes.option })
        .from(lessonPollVotes)
        .where(and(eq(lessonPollVotes.userId, userId), eq(lessonPollVotes.lessonId, lessonId)))
    },

    async tally(lessonId, pollId) {
      return db
        .select({
          option: lessonPollVotes.option,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(lessonPollVotes)
        .where(and(eq(lessonPollVotes.lessonId, lessonId), eq(lessonPollVotes.pollId, pollId)))
        .groupBy(lessonPollVotes.option)
    },
  }
}
