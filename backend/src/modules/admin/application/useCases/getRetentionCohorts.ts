import {
  COHORT_OFFSETS,
  addDays,
  retentionCell,
  utcDay,
  weekStart,
  type RetentionCell,
} from '../../domain/retention'
import type { RetentionReader } from '../ports/retentionReader'

export const DEFAULT_COHORT_WEEKS = 12

type OffsetCells = Record<'d1' | 'd7' | 'd30', RetentionCell>

export interface RetentionCohort {
  cohort_week: string
  size: number
  // "voltou" = qualquer acesso autenticado no dia; "estudou" = atividade qualificadora (RP1).
  returned: OffsetCells
  studied: OffsetCells
}

export interface RetentionCohorts {
  // Dia em que cada medida começou a ser registrada; nulo = ainda sem registro.
  tracking_since: { presence: string | null; activity: string | null }
  // Mais recente primeiro.
  cohorts: RetentionCohort[]
}

const KEYS = { 1: 'd1', 7: 'd7', 30: 'd30' } as const

// Retenção por coorte semanal de cadastro, dia 1, 7 e 30 (RP2), nas duas medidas de RP1. Uma célula
// cujo dia N ainda não chegou é "em andamento", nunca zero.
export class GetRetentionCohortsUseCase {
  constructor(
    private readonly reader: RetentionReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { weeks?: number } = {}): Promise<RetentionCohorts> {
    const weeks = input.weeks ?? DEFAULT_COHORT_WEEKS
    const today = utcDay(this.now())
    const tracking = await this.reader.trackingStart()
    const rows = await this.reader.cohortCounts({
      fromWeek: addDays(weekStart(today), -7 * (weeks - 1)),
      offsets: COHORT_OFFSETS,
      today,
      tracking,
    })

    const byWeek = new Map<string, RetentionCohort>()
    for (const row of rows) {
      const key = KEYS[row.offset as keyof typeof KEYS]
      if (!key) continue
      let cohort = byWeek.get(row.cohortWeek)
      if (!cohort) {
        cohort = {
          cohort_week: row.cohortWeek,
          size: row.size,
          returned: {} as OffsetCells,
          studied: {} as OffsetCells,
        }
        byWeek.set(row.cohortWeek, cohort)
      }
      cohort.returned[key] = retentionCell(row.size, row.returned)
      cohort.studied[key] = retentionCell(row.size, row.studied)
    }

    return {
      tracking_since: { presence: tracking.presenceSince, activity: tracking.activitySince },
      cohorts: [...byWeek.values()].sort((a, b) => b.cohort_week.localeCompare(a.cohort_week)),
    }
  }
}
