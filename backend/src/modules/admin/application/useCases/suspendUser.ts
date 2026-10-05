import type { UserRepository } from '../../../auth/application/ports/userRepository'
import {
  AdminAccountProtectedError,
  AdminUserNotFoundError,
  UserStatusConflictError,
} from '../../domain/errors'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Suspende uma conta (N.16): login e token passam a ser recusados
// (`403 account_suspended`), a conta sai do ranking e da busca de amigos, e o
// progresso fica intacto. Também revoga as sessões, pra um token antigo não
// voltar a valer quando a conta for reativada. Não cancela ordens em repouso:
// pra isso o admin usa a N.10. Conta `admin` nunca é suspensa pelo painel.
export class SuspendUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly recordAdminAction: RecordAdminActionUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(adminId: string, targetUserId: string, reason: string): Promise<void> {
    await this.recordAdminAction.run(
      {
        adminId,
        action: 'user.suspend',
        targetType: 'user',
        targetId: targetUserId,
        payload: { reason },
      },
      async () => {
        const user = await this.userRepository.findById(targetUserId)
        if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
        if (user.role === 'admin') {
          throw new AdminAccountProtectedError(
            'conta de administrador não pode ser suspensa pelo painel',
          )
        }
        if (user.status === 'suspended') {
          throw new UserStatusConflictError('a conta já está suspensa')
        }
        await this.userRepository.updateUser(targetUserId, {
          status: 'suspended',
          suspendedReason: reason,
          suspendedAt: this.now(),
        })
        await this.userRepository.revokeSessions(targetUserId)
      },
    )
  }
}
