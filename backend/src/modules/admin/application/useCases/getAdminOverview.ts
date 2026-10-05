import type { MarketOverview, MarketOverviewReader } from '../ports/marketOverviewReader'
import type { SchedulerAdmin, SchedulerStatus, TickRun } from '../ports/schedulerAdmin'
import type { UserStats, UserStatsReader } from '../ports/userStatsReader'

// Cada seção vem de uma fonte diferente (motor, agenda, banco de usuário). Uma que
// falha vira `null` com o motivo em `errors`, e as outras seguem: a tela de entrada
// do painel precisa abrir justamente quando algo está quebrado.
export interface AdminOverview {
  market: MarketOverview | null
  scheduler: SchedulerStatus | null
  last_tick: TickRun | null
  users: UserStats | null
  errors: Partial<Record<'market' | 'scheduler' | 'last_tick' | 'users', string>>
}

export class GetAdminOverviewUseCase {
  constructor(
    private readonly marketOverview: MarketOverviewReader,
    private readonly schedulerAdmin: SchedulerAdmin,
    private readonly userStats: UserStatsReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<AdminOverview> {
    const [market, scheduler, ticks, users] = await Promise.allSettled([
      this.marketOverview.get(),
      this.schedulerAdmin.getStatus(),
      this.schedulerAdmin.listTicks({ limit: 1 }),
      this.userStats.read(this.now()),
    ])

    const errors: AdminOverview['errors'] = {}
    const value = <T>(result: PromiseSettledResult<T>, key: keyof AdminOverview['errors']) => {
      if (result.status === 'fulfilled') return result.value
      errors[key] = result.reason instanceof Error ? result.reason.message : String(result.reason)
      return null
    }

    const ticksResult = value(ticks, 'last_tick')
    return {
      market: value(market, 'market'),
      scheduler: value(scheduler, 'scheduler'),
      last_tick: ticksResult?.ticks[0] ?? null,
      users: value(users, 'users'),
      errors,
    }
  }
}
