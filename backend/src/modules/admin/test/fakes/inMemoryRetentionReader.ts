import type { MeasureCounts, MilestoneKey } from '../../domain/retention'
import { MILESTONE_KEYS, addDays, utcDay, weekStart } from '../../domain/retention'
import type {
  CohortCountsRow,
  DailyActiveRow,
  MilestoneCohortRow,
  MilestoneOverallRow,
  MilestoneStats,
  RetentionReader,
  TrackingStart,
} from '../../application/ports/retentionReader'

export interface SyntheticUser {
  id: string
  role?: 'user' | 'admin'
  createdAt: Date
}

export interface SyntheticMilestone {
  userId: string
  milestone: Exclude<MilestoneKey, 'first_return'>
  reachedAt: Date
}

export interface RetentionDataset {
  users: SyntheticUser[]
  // `${userId}|${day}`
  presence: Set<string>
  activity: Set<string>
  milestones: SyntheticMilestone[]
}

const key = (userId: string, day: string) => `${userId}|${day}`

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length / 2
  return sorted.length % 2 === 1 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Implementação em memória do `RetentionReader` com a MESMA semântica do SQL do adapter Drizzle.
// Serve de fake nos testes dos casos de uso e de oráculo no teste de integração (mesmo conjunto de
// dados nos dois, resultados iguais).
export function createInMemoryRetentionReader(data: RetentionDataset): RetentionReader {
  const people = data.users.filter((u) => (u.role ?? 'user') === 'user')
  const signupDay = (u: SyntheticUser) => utcDay(u.createdAt)
  const minDay = (set: Set<string>): string | null => {
    let min: string | null = null
    for (const entry of set) {
      const day = entry.split('|')[1]
      if (min === null || day < min) min = day
    }
    return min
  }

  const counts = (
    set: Set<string>,
    since: string | null,
    user: SyntheticUser,
    offset: number,
    today: string,
    acc: MeasureCounts,
  ) => {
    const target = addDays(signupDay(user), offset)
    if (target >= today) acc.open++
    else if (since === null || target < since) acc.beforeTracking++
    else {
      acc.measurable++
      if (set.has(key(user.id, target))) acc.active++
    }
  }

  return {
    async trackingStart(): Promise<TrackingStart> {
      return { presenceSince: minDay(data.presence), activitySince: minDay(data.activity) }
    },

    async cohortCounts({ fromWeek, offsets, today, tracking }) {
      const rows = new Map<string, CohortCountsRow>()
      for (const user of people) {
        const cohortWeek = weekStart(signupDay(user))
        if (cohortWeek < fromWeek) continue
        for (const offset of offsets) {
          const id = `${cohortWeek}|${offset}`
          let row = rows.get(id)
          if (!row) {
            const empty = (): MeasureCounts => ({
              open: 0,
              beforeTracking: 0,
              measurable: 0,
              active: 0,
            })
            row = { cohortWeek, offset, size: 0, returned: empty(), studied: empty() }
            rows.set(id, row)
          }
          row.size++
          counts(data.presence, tracking.presenceSince, user, offset, today, row.returned)
          counts(data.activity, tracking.activitySince, user, offset, today, row.studied)
        }
      }
      return [...rows.values()]
    },

    async dailyActive({ from, to }) {
      const isPerson = new Set(people.map((u) => u.id))
      const peopleByDay = (set: Set<string>) => {
        const byDay = new Map<string, Set<string>>()
        for (const entry of set) {
          const [id, day] = entry.split('|')
          if (!isPerson.has(id)) continue
          const bucket = byDay.get(day) ?? new Set<string>()
          bucket.add(id)
          byDay.set(day, bucket)
        }
        return byDay
      }
      const presenceByDay = peopleByDay(data.presence)
      const activityByDay = peopleByDay(data.activity)
      const out: DailyActiveRow[] = []
      for (let day = from; day <= to; day = addDays(day, 1)) {
        const mau = new Set<string>()
        for (let back = 0; back < 30; back++) {
          for (const id of presenceByDay.get(addDays(day, -back)) ?? []) mau.add(id)
        }
        out.push({
          day,
          returned: presenceByDay.get(day)?.size ?? 0,
          studied: activityByDay.get(day)?.size ?? 0,
          mau: mau.size,
        })
      }
      return out
    },

    async milestoneStats({ fromWeek, trackingSince }): Promise<MilestoneStats> {
      const eligible = people.filter(
        (u) =>
          trackingSince !== null &&
          signupDay(u) >= trackingSince &&
          weekStart(signupDay(u)) >= fromWeek,
      )
      const ids = new Set(eligible.map((u) => u.id))
      const byUser = new Map(eligible.map((u) => [u.id, u]))

      const events: Array<{ userId: string; milestone: MilestoneKey; seconds: number }> = []
      for (const m of data.milestones) {
        const user = byUser.get(m.userId)
        if (!user) continue
        events.push({
          userId: m.userId,
          milestone: m.milestone,
          seconds: (m.reachedAt.getTime() - user.createdAt.getTime()) / 1000,
        })
      }
      const firstReturn = new Map<string, string>()
      for (const entry of data.presence) {
        const [id, day] = entry.split('|')
        const user = byUser.get(id)
        if (!user || day <= signupDay(user)) continue
        const current = firstReturn.get(id)
        if (current === undefined || day < current) firstReturn.set(id, day)
      }
      for (const user of eligible) {
        const first = firstReturn.get(user.id) ?? null
        if (first !== null) {
          const days =
            (Date.parse(`${first}T00:00:00Z`) - Date.parse(`${signupDay(user)}T00:00:00Z`)) /
            86_400_000
          events.push({ userId: user.id, milestone: 'first_return', seconds: days * 86_400 })
        }
      }

      const overall: MilestoneOverallRow[] = MILESTONE_KEYS.flatMap((milestone) => {
        const mine = events.filter((e) => e.milestone === milestone && ids.has(e.userId))
        if (mine.length === 0) return []
        return [
          { milestone, reached: mine.length, medianSeconds: median(mine.map((e) => e.seconds)) },
        ]
      })

      const cohorts = new Map<string, MilestoneCohortRow>()
      for (const user of eligible) {
        const cohortWeek = weekStart(signupDay(user))
        const row = cohorts.get(cohortWeek) ?? { cohortWeek, size: 0, reached: {} }
        row.size++
        cohorts.set(cohortWeek, row)
      }
      for (const e of events) {
        const row = cohorts.get(weekStart(signupDay(byUser.get(e.userId) as SyntheticUser)))
        if (row) row.reached[e.milestone] = (row.reached[e.milestone] ?? 0) + 1
      }
      return { eligible: eligible.length, overall, byCohort: [...cohorts.values()] }
    },
  }
}
