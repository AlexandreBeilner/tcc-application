import type { IntegrityAdmin, IntegrityRun } from '../ports/integrityAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Abre a verificação de integridade (N.21). Só lê o banco, mas é uma leitura longa e feita por
// um humano, então é auditada (`integrity.check`, com o id da verificação).
export class StartIntegrityCheckUseCase {
  constructor(
    private readonly integrityAdmin: IntegrityAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string): Promise<IntegrityRun> {
    return this.recordAdminAction.run(
      { adminId, action: 'integrity.check', targetType: 'integrity_check' },
      () => this.integrityAdmin.start(),
      (run) => ({ targetId: run.id }),
    )
  }
}

// A última verificação (ou `null` se nenhuma rodou desde a subida do motor).
export class GetIntegrityRunUseCase {
  constructor(private readonly integrityAdmin: IntegrityAdmin) {}

  execute(): Promise<IntegrityRun | null> {
    return this.integrityAdmin.latest()
  }
}
