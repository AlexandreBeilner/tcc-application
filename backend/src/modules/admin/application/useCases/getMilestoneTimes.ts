import {
  MILESTONE_GRANULARITY,
  MILESTONE_KEYS,
  addDays,
  isCohortMatured,
  utcDay,
  weekStart,
  type MilestoneKey,
} from '../../domain/retention'
import type { RetentionReader } from '../ports/retentionReader'
import { DEFAULT_COHORT_WEEKS } from './getRetentionCohorts'

export interface MilestoneSummary {
  milestone: MilestoneKey
  granularity: 'day' | 'second'
  reached: number
  // Fração das pessoas elegíveis que já chegaram; nula sem elegíveis.
  reached_rate: number | null
  // Mediana do tempo entre o cadastro e o marco, só de quem chegou; nula se ninguém chegou.
  median_seconds: number | null
}

export interface MilestoneCohort {
  cohort_week: string
  size: number
  // Coortes com menos de 30 dias depois do fim da semana ainda estão subindo.
  status: 'complete' | 'in_progress'
  rates: Record<MilestoneKey, number | null>
}

export interface MilestoneTimes {
  // Só entram pessoas cadastradas depois do início do registro; as anteriores não têm marco gravado.
  tracking_since: string | null
  eligible: number
  milestones: MilestoneSummary[]
  cohorts: MilestoneCohort[]
}

// Tempo até cada marco de RP3 e a % de cada coorte que chegou nele.
export class GetMilestoneTimesUseCase {
  constructor(
    private readonly reader: RetentionReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { weeks?: number } = {}): Promise<MilestoneTimes> {
    const weeks = input.weeks ?? DEFAULT_COHORT_WEEKS
    const today = utcDay(this.now())
    const { presenceSince } = await this.reader.trackingStart()
    // Quem se cadastrou no dia em que o registro começou pode ter feito o marco antes dele.
    const trackingSince = presenceSince === null ? null : addDays(presenceSince, 1)
    const stats = await this.reader.milestoneStats({
      fromWeek: addDays(weekStart(today), -7 * (weeks - 1)),
      trackingSince,
    })

    const overall = new Map(stats.overall.map((row) => [row.milestone, row]))
    const milestones = MILESTONE_KEYS.map<MilestoneSummary>((milestone) => {
      const row = overall.get(milestone)
      const reached = row?.reached ?? 0
      return {
        milestone,
        granularity: MILESTONE_GRANULARITY[milestone],
        reached,
        reached_rate: stats.eligible > 0 ? reached / stats.eligible : null,
        median_seconds: row?.medianSeconds ?? null,
      }
    })

    const cohorts = stats.byCohort
      .map<MilestoneCohort>((cohort) => ({
        cohort_week: cohort.cohortWeek,
        size: cohort.size,
        status: isCohortMatured(cohort.cohortWeek, today) ? 'complete' : 'in_progress',
        rates: Object.fromEntries(
          MILESTONE_KEYS.map((key) => [
            key,
            cohort.size > 0 ? (cohort.reached[key] ?? 0) / cohort.size : null,
          ]),
        ) as MilestoneCohort['rates'],
      }))
      .sort((a, b) => b.cohort_week.localeCompare(a.cohort_week))

    return { tracking_since: trackingSince, eligible: stats.eligible, milestones, cohorts }
  }
}
