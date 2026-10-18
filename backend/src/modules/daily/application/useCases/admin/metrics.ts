import { addDays, dailyDay } from '../../../domain/gameDay'
import {
  DEFAULT_METRICS_DAYS,
  MAX_METRICS_DAYS,
  type DailyMetricsDay,
} from '../../../domain/metrics'
import type { DailyMetricsRepository } from '../../ports/dailyMetricsRepository'

// Visão do painel (DI.7.1): um dia por linha, do mais recente ao mais antigo, com zero nos dias
// sem registro. Quem tem conta vem de `daily_results`; os demais, dos contadores.
export class GetDailyMetricsUseCase {
  constructor(
    private readonly metrics: DailyMetricsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { days?: number } = {}): Promise<DailyMetricsDay[]> {
    const days = Math.min(Math.max(input.days ?? DEFAULT_METRICS_DAYS, 1), MAX_METRICS_DAYS)
    const to = dailyDay(this.now())
    const from = addDays(to, -(days - 1))
    const [stored, logged] = await Promise.all([
      this.metrics.listStored(from, to),
      this.metrics.listLoggedGames(from, to),
    ])

    const byDate = new Map<string, DailyMetricsDay>()
    for (let i = 0; i < days; i++) {
      const date = addDays(to, -i)
      byDate.set(date, {
        date,
        anonStarted: 0,
        anonCompleted: 0,
        loggedStarted: 0,
        loggedCompleted: 0,
        signups: 0,
        logins: 0,
      })
    }
    for (const row of stored) {
      const day = byDate.get(row.date)
      if (!day) continue
      if (row.metric === 'anon_started') day.anonStarted = row.count
      else if (row.metric === 'anon_completed') day.anonCompleted = row.count
      else if (row.metric === 'origin_signup') day.signups = row.count
      else day.logins = row.count
    }
    for (const row of logged) {
      const day = byDate.get(row.date)
      if (!day) continue
      day.loggedStarted = row.started
      day.loggedCompleted = row.completed
    }
    return [...byDate.values()]
  }
}
