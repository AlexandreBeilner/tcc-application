import type { SchedulerAdmin, SchedulerStatus } from '../ports/schedulerAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Pausar e retomar o tick agendado (N.6). A regra (a pausa só vale pro tick
// agendado, retomar não recupera o tempo parado) vive no motor; aqui só a
// auditoria de quem mudou o estado, inclusive quando o motor recusa (409, agenda
// desligada no ambiente). Idempotente como a rota do motor: repetir grava outra
// linha de auditoria, porque a intenção do admin também é um fato.
export class SetSchedulerPausedUseCase {
  constructor(
    private readonly schedulerAdmin: SchedulerAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, paused: boolean): Promise<SchedulerStatus> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: paused ? 'scheduler.pause' : 'scheduler.resume',
        targetType: 'scheduler',
      },
      () => (paused ? this.schedulerAdmin.pause() : this.schedulerAdmin.resume()),
    )
  }
}
