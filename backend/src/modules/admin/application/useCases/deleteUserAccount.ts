import type { AnonymizeAccountUseCase } from '../../../auth/application/useCases/anonymizeAccount'
import type { UserRepository } from '../../../auth/application/ports/userRepository'
import {
  AdminAccountProtectedError,
  AdminUserNotFoundError,
  DeleteConfirmationMismatchError,
} from '../../domain/errors'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Exclusão de conta a pedido (LGPD, N.16): mesmo caminho do `DELETE /me`
// (anonimização, nunca DELETE físico, porque o histórico imutável guarda o id).
// Confirmação dupla: o painel exige senha recente (N.22) e o `username` atual
// digitado de volta. O log guarda só o id do alvo, nunca o username, que
// deixaria de ser dado pessoal só depois de anonimizado. Conta `admin` não é
// excluída pelo painel.
export class DeleteUserAccountUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly anonymizeAccount: AnonymizeAccountUseCase,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, targetUserId: string, confirmUsername: string): Promise<void> {
    await this.recordAdminAction.run(
      { adminId, action: 'user.delete', targetType: 'user', targetId: targetUserId },
      async () => {
        const user = await this.userRepository.findById(targetUserId)
        if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
        if (user.role === 'admin') {
          throw new AdminAccountProtectedError(
            'conta de administrador não pode ser excluída pelo painel',
          )
        }
        if (user.username !== confirmUsername) {
          throw new DeleteConfirmationMismatchError('o username digitado não confere')
        }
        await this.anonymizeAccount.execute({ userId: targetUserId })
      },
    )
  }
}
