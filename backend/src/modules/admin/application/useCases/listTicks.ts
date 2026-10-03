import type { ListTicksQuery, ListTicksResult, SchedulerAdmin } from '../ports/schedulerAdmin'

// Delegação fina (leitura do histórico de ticks).
export class ListTicksUseCase {
  constructor(private readonly schedulerAdmin: SchedulerAdmin) {}

  async execute(query: ListTicksQuery): Promise<ListTicksResult> {
    return this.schedulerAdmin.listTicks(query)
  }
}
