import type { UserRepository } from '../../../auth/application/ports/userRepository'
import { AdminUserNotFoundError } from '../../domain/errors'
import type { UserCashCreditor } from '../ports/userCashCreditor'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Crédito de caixa simulado na conta de um usuário (N.17), sem teto de negócio (decisão
// do autor, achado 029 item 5): reparar prejuízo causado por bug ou preparar conta de
// demonstração. É caixa livre, nunca capital de risco, então não infla a rentabilidade.
// O valor, o usuário e o motivo (se houver) vão pro log; o que o motor de fato creditou
// (centavos) entra como resultado.
export class CreditUserCashUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cashCreditor: UserCashCreditor,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(
    adminId: string,
    targetUserId: string,
    input: { amount: number; reason?: string },
  ): Promise<{ credited: number }> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'user.credit',
        targetType: 'user',
        targetId: targetUserId,
        payload: {
          amount: input.amount,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      },
      async () => {
        const user = await this.userRepository.findById(targetUserId)
        if (!user) throw new AdminUserNotFoundError('usuário não encontrado')
        return this.cashCreditor.credit(targetUserId, input.amount)
      },
      (result) => ({ payload: { credited: result.credited } }),
    )
  }
}
