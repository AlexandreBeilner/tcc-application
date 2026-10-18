import { dailyDay, gameNumberFor, resolveStatus } from '../../domain/gameDay'
import { computeStats, type DailyStats } from '../../domain/stats'
import type { DailyResultRepository } from '../ports/dailyResultRepository'
import type { DailySettingsRepository } from '../ports/dailySettingsRepository'

// `GET /daily/me/stats`: jogos, acerto por cartão, distribuição de tentativas do Termo e sequência
// do Diário. Só conta o que foi jogado logado (DI8).
export class GetMyStatsUseCase {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly results: DailyResultRepository,
  ) {}

  async execute(input: { userId: string; now: Date }): Promise<DailyStats> {
    const { startDate } = await this.settings.get()
    const day = dailyDay(input.now)
    const state = resolveStatus(startDate, day)
    const todayNumber = state.status === 'live' ? gameNumberFor(state.startDate, day) : null
    return computeStats(await this.results.listByUser(input.userId), todayNumber)
  }
}
