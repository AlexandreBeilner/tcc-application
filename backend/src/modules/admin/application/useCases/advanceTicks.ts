import type { AdvanceTicksResult, SchedulerAdmin } from '../ports/schedulerAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// "Avançar N dias" (N.6): roda N ticks manuais de uma vez no motor, afetando
// todos os usuários (o mercado é compartilhado). Auditado como UMA ação com o
// número pedido e o que de fato rodou; numa falha no meio, o motivo fica no log
// (os ticks já rodados ficam no histórico de ticks do motor).
export class AdvanceTicksUseCase {
  constructor(
    private readonly schedulerAdmin: SchedulerAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, days: number): Promise<AdvanceTicksResult> {
    return this.recordAdminAction.run(
      { adminId, action: 'tick.advance', targetType: 'tick', payload: { days } },
      () => this.schedulerAdmin.advance(days),
      (result) => {
        const lastDay = result.ticks.at(-1)?.day
        return {
          targetId: lastDay === undefined ? undefined : String(lastDay),
          payload: { executed: result.ticks.length, last_day: lastDay ?? null },
        }
      },
    )
  }
}
