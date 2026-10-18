import { and, gte, lte, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyMetrics, dailyResults } from '../../../../db/schema'
import type { DailyMetricsRepository } from '../../application/ports/dailyMetricsRepository'
import type { StoredMetric } from '../../domain/metrics'

export function createDrizzleDailyMetricsRepository(db: Database): DailyMetricsRepository {
  return {
    async increment(day, metric) {
      await db
        .insert(dailyMetrics)
        .values({ metricDate: day, metric, count: 1 })
        .onConflictDoUpdate({
          target: [dailyMetrics.metricDate, dailyMetrics.metric],
          set: { count: sql`${dailyMetrics.count} + 1` },
        })
    },

    async listStored(from, to) {
      const rows = await db
        .select()
        .from(dailyMetrics)
        .where(and(gte(dailyMetrics.metricDate, from), lte(dailyMetrics.metricDate, to)))
      return rows.map((r) => ({
        date: r.metricDate,
        metric: r.metric as StoredMetric,
        count: r.count,
      }))
    },

    async listLoggedGames(from, to) {
      const startedDay = sql<string>`to_char(${dailyResults.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
      const completedDay = sql<string>`to_char(${dailyResults.completedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
      const started = await db
        .select({ date: startedDay, n: sql<number>`count(*)`.mapWith(Number) })
        .from(dailyResults)
        .where(and(sql`${startedDay} >= ${from}`, sql`${startedDay} <= ${to}`))
        .groupBy(startedDay)
      const completed = await db
        .select({ date: completedDay, n: sql<number>`count(*)`.mapWith(Number) })
        .from(dailyResults)
        .where(and(sql`${completedDay} >= ${from}`, sql`${completedDay} <= ${to}`))
        .groupBy(completedDay)

      const byDate = new Map<string, { date: string; started: number; completed: number }>()
      const at = (date: string) => {
        const row = byDate.get(date) ?? { date, started: 0, completed: 0 }
        byDate.set(date, row)
        return row
      }
      for (const r of started) at(r.date).started = r.n
      for (const r of completed) at(r.date).completed = r.n
      return [...byDate.values()]
    },
  }
}
