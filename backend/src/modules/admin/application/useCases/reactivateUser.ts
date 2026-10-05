import type { UserRepository } from '../../../auth/application/ports/userRepository'
import { AdminUserNotFoundError, UserStatusConflictError } from '../../domain/errors'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Reativa uma conta suspensa (N.16): restaura o acesso sem perda de progresso.
// A sessão antiga continua morta (a suspensão revogou): a pessoa loga de novo.
export class ReactivateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, targetUserId: string): Promise<void> {
    await this.recordAdminAction.run(
      { adminId, action: 'user.reactivate', targetType: 'user', targetId: targetUserId },
      async () => {
        const user = await this.userRepository.findById(targetUserId)
        if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
        if (user.status !== 'suspended') {
          throw new UserStatusConflictError('a conta não está suspensa')
        }
        await this.userRepository.updateUser(targetUserId, {
          status: 'active',
          suspendedReason: null,
          suspendedAt: null,
        })
      },
    )
  }
}
