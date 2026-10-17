import { utcDateString } from '../../../../shared/utcDate'
import type { DailyResultRepository } from '../ports/dailyResultRepository'

// Verifica se o usuário fechou hoje (UTC) um jogo que valeu XP, para a missão "Jogue o Diário"
// (DI.6.1). `xpAwarded > 0` é a marca de jogo do dia concluído antes da virada: dia anterior jogado
// hoje, ou jogo fechado depois da virada, não conta.
export class HasCompletedDailyTodayUseCase {
  constructor(private readonly results: DailyResultRepository) {}

  async execute(input: { userId: string; now: Date }): Promise<boolean> {
    const today = utcDateString(input.now)
    return (await this.results.listByUser(input.userId)).some(
      (r) => r.completedAt !== null && r.xpAwarded > 0 && utcDateString(r.completedAt) === today,
    )
  }
}
