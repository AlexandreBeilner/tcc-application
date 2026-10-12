import { randomUUID } from 'node:crypto'
import type { AuthMailer } from '../../../auth/application/ports/authMailer'
import type { UserRepository } from '../../../auth/application/ports/userRepository'
import { AdminUserNotFoundError } from '../../domain/errors'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Encerra todas as sessões do usuário (N.16): incrementa `token_version`, e o
// `authMiddleware` passa a recusar qualquer token emitido antes. A pessoa
// continua podendo logar de novo.
export class ForceLogoutUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly recordAdminAction: RecordAdminActionUseCase,
    private readonly mailer: AuthMailer,
    // Cada "forçar logout" é um evento novo: o id só serve de chave de idempotência do aviso.
    private readonly newEventId: () => string = randomUUID,
  ) {}

  async execute(adminId: string, targetUserId: string): Promise<void> {
    await this.recordAdminAction.run(
      { adminId, action: 'user.force_logout', targetType: 'user', targetId: targetUserId },
      async () => {
        const user = await this.userRepository.findById(targetUserId)
        if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
        await this.userRepository.revokeSessions(targetUserId)
        // Já encerrou as sessões e a ação será auditada: falha ao enfileirar o aviso (E4) só é logada.
        try {
          await this.mailer.sendSessionsEnded({
            userId: user.id,
            to: user.email,
            name: user.name,
            eventId: this.newEventId(),
          })
        } catch (err) {
          console.error('[admin] falha ao enfileirar o aviso de sessões encerradas', err)
        }
      },
    )
  }
}
