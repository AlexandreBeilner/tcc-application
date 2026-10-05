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
  ) {}

  async execute(adminId: string, targetUserId: string): Promise<void> {
    await this.recordAdminAction.run(
      { adminId, action: 'user.force_logout', targetType: 'user', targetId: targetUserId },
      async () => {
        const user = await this.userRepository.findById(targetUserId)
        if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
        await this.userRepository.revokeSessions(targetUserId)
      },
    )
  }
}
