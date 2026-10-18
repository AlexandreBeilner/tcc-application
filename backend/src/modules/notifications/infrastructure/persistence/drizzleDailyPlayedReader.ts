import { and, gt, inArray, isNotNull, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyResults } from '../../../../db/schema'
import type { DailyPlayedReader } from '../../application/ports/dailyPlayedReader'

// Leitura em lote dos jogos do Diário por pessoa (DI.6.2). `completed_at` em UTC é o dia em que o
// jogo foi fechado; com `xp_awarded > 0` (o que só existe se fechou antes da virada) é também o dia
// do jogo. Cada linha é um jogo, então contar linhas distintas por pessoa é contar dias.
export function createDrizzleDailyPlayedReader(db: Database): DailyPlayedReader {
  return {
    async countPlayedDays(userIds, window) {
      if (userIds.length === 0) return null
      const completedDay = sql`(${dailyResults.completedAt} AT TIME ZONE 'UTC')::date`
      const inWindow = and(
        isNotNull(dailyResults.completedAt),
        gt(dailyResults.xpAwarded, 0),
        sql`${completedDay} BETWEEN ${window.from}::date AND ${window.to}::date`,
      )

      const [anyone] = await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(dailyResults)
        .where(inWindow)
      if (!anyone || anyone.n === 0) return null

      const rows = await db
        .select({
          userId: dailyResults.userId,
          days: sql<number>`count(DISTINCT ${completedDay})`.mapWith(Number),
        })
        .from(dailyResults)
        .where(and(inWindow, inArray(dailyResults.userId, userIds)))
        .groupBy(dailyResults.userId)
      return new Map(rows.map((r) => [r.userId, r.days]))
    },
  }
}
