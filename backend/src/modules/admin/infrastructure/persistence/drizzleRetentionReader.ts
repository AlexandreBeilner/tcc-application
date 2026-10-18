import { sql, type SQL } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { MILESTONE_KEYS, type MilestoneKey } from '../../domain/retention'
import type {
  CohortCountsRow,
  DailyActiveRow,
  MilestoneCohortRow,
  MilestoneOverallRow,
  RetentionReader,
  TrackingStart,
} from '../../application/ports/retentionReader'

// Consultas agregadas do painel de retenção (RT.1.2). Tudo em UTC e só para `role = user`. Datas
// voltam como texto (`::text`) e contagens como inteiro (`::int`): o driver devolveria `Date` no fuso
// do servidor e `bigint` como string. Nenhuma linha identifica uma pessoa (RP4).

type Row = Record<string, unknown>

async function rowsOf(db: Database, query: SQL): Promise<Row[]> {
  const result = await db.execute(query)
  return result.rows as Row[]
}

// Dia de cadastro e semana da coorte (segunda-feira) em UTC.
const SIGNUP_DAY = sql`(u.created_at AT TIME ZONE 'UTC')::date`

function measureColumns(alias: string, table: SQL, since: string | null, today: string): SQL {
  // Ordem do CASE = a mesma do oráculo em memória: aberto, depois anterior ao registro, depois medido.
  const tracked = since === null ? sql`FALSE` : sql`t.target_day >= ${since}::date`
  const hit = sql`EXISTS (SELECT 1 FROM ${table} x WHERE x.user_id = t.id AND x.day = t.target_day)`
  return sql`
    count(*) FILTER (WHERE t.target_day >= ${today}::date)::int AS ${sql.raw(`${alias}_open`)},
    count(*) FILTER (WHERE t.target_day < ${today}::date AND NOT (${tracked}))::int AS ${sql.raw(`${alias}_before`)},
    count(*) FILTER (WHERE t.target_day < ${today}::date AND ${tracked})::int AS ${sql.raw(`${alias}_measurable`)},
    count(*) FILTER (WHERE t.target_day < ${today}::date AND ${tracked} AND ${hit})::int AS ${sql.raw(`${alias}_active`)}
  `
}

export function createDrizzleRetentionReader(db: Database): RetentionReader {
  return {
    async trackingStart(): Promise<TrackingStart> {
      const [presence] = await rowsOf(db, sql`SELECT min(day)::text AS d FROM daily_presence`)
      const [activity] = await rowsOf(db, sql`SELECT min(day)::text AS d FROM daily_activity`)
      return {
        presenceSince: (presence?.d as string | null) ?? null,
        activitySince: (activity?.d as string | null) ?? null,
      }
    },

    async cohortCounts({ fromWeek, offsets, today, tracking }) {
      const offsetList = sql.join(
        offsets.map((o) => sql`${Math.trunc(o)}`),
        sql`, `,
      )
      const rows = await rowsOf(
        db,
        sql`
          WITH targets AS (
            SELECT u.id,
                   date_trunc('week', u.created_at AT TIME ZONE 'UTC')::date AS cohort_week,
                   o.n AS day_offset,
                   (${SIGNUP_DAY} + o.n) AS target_day
              FROM users u
             CROSS JOIN unnest(ARRAY[${offsetList}]::int[]) AS o(n)
             WHERE u.role = 'user'
               AND date_trunc('week', u.created_at AT TIME ZONE 'UTC')::date >= ${fromWeek}::date
          )
          SELECT t.cohort_week::text AS cohort_week,
                 t.day_offset AS day_offset,
                 count(*)::int AS size,
                 ${measureColumns('ret', sql`daily_presence`, tracking.presenceSince, today)},
                 ${measureColumns('stu', sql`daily_activity`, tracking.activitySince, today)}
            FROM targets t
           GROUP BY t.cohort_week, t.day_offset
        `,
      )
      return rows.map<CohortCountsRow>((r) => ({
        cohortWeek: r.cohort_week as string,
        offset: Number(r.day_offset),
        size: Number(r.size),
        returned: {
          open: Number(r.ret_open),
          beforeTracking: Number(r.ret_before),
          measurable: Number(r.ret_measurable),
          active: Number(r.ret_active),
        },
        studied: {
          open: Number(r.stu_open),
          beforeTracking: Number(r.stu_before),
          measurable: Number(r.stu_measurable),
          active: Number(r.stu_active),
        },
      }))
    },

    async dailyActive({ from, to }) {
      const rows = await rowsOf(
        db,
        sql`
          SELECT d.day::text AS day,
                 (SELECT count(*) FROM daily_presence p JOIN users u ON u.id = p.user_id
                   WHERE p.day = d.day AND u.role = 'user')::int AS returned,
                 (SELECT count(*) FROM daily_activity a JOIN users u ON u.id = a.user_id
                   WHERE a.day = d.day AND u.role = 'user')::int AS studied,
                 (SELECT count(DISTINCT p.user_id) FROM daily_presence p JOIN users u ON u.id = p.user_id
                   WHERE p.day BETWEEN d.day - 29 AND d.day AND u.role = 'user')::int AS mau
            FROM generate_series(${from}::timestamp, ${to}::timestamp, interval '1 day') AS g(ts)
           CROSS JOIN LATERAL (SELECT g.ts::date AS day) d
           ORDER BY d.day
        `,
      )
      return rows.map<DailyActiveRow>((r) => ({
        day: r.day as string,
        returned: Number(r.returned),
        studied: Number(r.studied),
        mau: Number(r.mau),
      }))
    },

    async milestoneStats({ fromWeek, trackingSince }) {
      if (trackingSince === null) return { eligible: 0, overall: [], byCohort: [] }

      const eligibleCte = sql`
        eligible AS (
          SELECT u.id, u.created_at, ${SIGNUP_DAY} AS signup_day,
                 date_trunc('week', u.created_at AT TIME ZONE 'UTC')::date AS cohort_week
            FROM users u
           WHERE u.role = 'user'
             AND ${SIGNUP_DAY} >= ${trackingSince}::date
             AND date_trunc('week', u.created_at AT TIME ZONE 'UTC')::date >= ${fromWeek}::date
        ),
        events AS (
          SELECT m.user_id, m.milestone,
                 extract(epoch FROM (m.reached_at - e.created_at)) AS seconds
            FROM user_milestones m
            JOIN eligible e ON e.id = m.user_id
          UNION ALL
          SELECT p.user_id, 'first_return' AS milestone,
                 ((min(p.day) - e.signup_day) * 86400)::double precision AS seconds
            FROM daily_presence p
            JOIN eligible e ON e.id = p.user_id AND p.day > e.signup_day
           GROUP BY p.user_id, e.signup_day
        )
      `
      const known = sql.join(
        MILESTONE_KEYS.map((k) => sql`${k}`),
        sql`, `,
      )
      const [totals] = await rowsOf(
        db,
        sql`WITH ${eligibleCte} SELECT count(*)::int AS n FROM eligible`,
      )
      const overallRows = await rowsOf(
        db,
        sql`
          WITH ${eligibleCte}
          SELECT milestone, count(*)::int AS reached,
                 percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds) AS median_seconds
            FROM events
           WHERE milestone IN (${known})
           GROUP BY milestone
        `,
      )
      const sizeRows = await rowsOf(
        db,
        sql`
          WITH ${eligibleCte}
          SELECT cohort_week::text AS cohort_week, count(*)::int AS size
            FROM eligible GROUP BY cohort_week
        `,
      )
      const reachedRows = await rowsOf(
        db,
        sql`
          WITH ${eligibleCte}
          SELECT e.cohort_week::text AS cohort_week, v.milestone, count(*)::int AS reached
            FROM events v
            JOIN eligible e ON e.id = v.user_id
           WHERE v.milestone IN (${known})
           GROUP BY e.cohort_week, v.milestone
        `,
      )

      const overall = overallRows.map<MilestoneOverallRow>((r) => ({
        milestone: r.milestone as MilestoneKey,
        reached: Number(r.reached),
        medianSeconds: r.median_seconds === null ? null : Number(r.median_seconds),
      }))
      const cohorts = new Map<string, MilestoneCohortRow>(
        sizeRows.map((r) => [
          r.cohort_week as string,
          { cohortWeek: r.cohort_week as string, size: Number(r.size), reached: {} },
        ]),
      )
      for (const r of reachedRows) {
        const cohort = cohorts.get(r.cohort_week as string)
        if (cohort) cohort.reached[r.milestone as MilestoneKey] = Number(r.reached)
      }
      return { eligible: Number(totals.n), overall, byCohort: [...cohorts.values()] }
    },
  }
}
