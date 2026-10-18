import type { MeasureCounts, MilestoneKey } from '../../domain/retention'

// Dia em que cada medida passou a ser registrada (primeiro dia com linha). `null` = ainda não há
// nenhum registro. Tudo antes disso é "sem dado" no painel, nunca zero.
export interface TrackingStart {
  presenceSince: string | null
  activitySince: string | null
}

export interface CohortCountsRow {
  // Segunda-feira da semana de cadastro.
  cohortWeek: string
  offset: number
  size: number
  returned: MeasureCounts
  studied: MeasureCounts
}

export interface DailyActiveRow {
  day: string
  returned: number
  studied: number
  // Pessoas distintas com presença nos 30 dias que terminam em `day` (inclusive).
  mau: number
}

export interface MilestoneOverallRow {
  milestone: MilestoneKey
  reached: number
  // Mediana em segundos entre o cadastro e o marco; nula quando ninguém chegou.
  medianSeconds: number | null
}

export interface MilestoneCohortRow {
  cohortWeek: string
  size: number
  reached: Partial<Record<MilestoneKey, number>>
}

export interface MilestoneStats {
  // Pessoas que entram nas contas de marcos (cadastradas depois do início do registro).
  eligible: number
  overall: MilestoneOverallRow[]
  byCohort: MilestoneCohortRow[]
}

// Consultas agregadas sobre `users`, `daily_presence`, `daily_activity` e `user_milestones`. Só
// números: nenhuma linha identifica uma pessoa (RP4, RNF09). Conta apenas `role = user`.
export interface RetentionReader {
  trackingStart(): Promise<TrackingStart>
  cohortCounts(params: {
    // Segunda-feira da coorte mais antiga a devolver.
    fromWeek: string
    offsets: readonly number[]
    // Hoje em UTC: o dia N só é medido quando é anterior a hoje.
    today: string
    tracking: TrackingStart
  }): Promise<CohortCountsRow[]>
  dailyActive(params: { from: string; to: string }): Promise<DailyActiveRow[]>
  milestoneStats(params: {
    fromWeek: string
    trackingSince: string | null
  }): Promise<MilestoneStats>
}
