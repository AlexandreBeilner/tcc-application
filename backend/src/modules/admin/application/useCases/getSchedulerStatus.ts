import type { SchedulerAdmin, SchedulerStatus } from '../ports/schedulerAdmin'

// Delegação fina (leitura), mesmo padrão de ListMacroEventsUseCase.
export class GetSchedulerStatusUseCase {
  constructor(private readonly schedulerAdmin: SchedulerAdmin) {}

  async execute(): Promise<SchedulerStatus> {
    return this.schedulerAdmin.getStatus()
  }
}
