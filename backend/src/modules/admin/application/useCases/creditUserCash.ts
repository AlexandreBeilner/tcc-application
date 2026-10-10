import type { AccountMailer } from '../../../auth/application/ports/accountMailer'
import { notifySafely } from '../../../auth/application/notifySafely'
import type { UserRepository } from '../../../auth/application/ports/userRepository'
import { AdminUserNotFoundError } from '../../domain/errors'
import type { UserCashCreditor } from '../ports/userCashCreditor'
import type { RecordAdminActionUseCase } from './recordAdminAction'
import { randomUUID } from 'node:crypto'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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
    private readonly mailer: AccountMailer,
    private readonly newEventId: () => string = randomUUID,
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
        const result = await this.cashCreditor.credit(targetUserId, input.amount)
        // E10: o motivo é nota interna do admin e não vai no e-mail, só o que o motor creditou.
        await notifySafely('o aviso de crédito', () =>
          this.mailer.sendAccountAdjusted({
            userId: user.id,
            to: user.email,
            name: user.name,
            summary: `${brl.format(result.credited)} foram creditados no seu caixa.`,
            eventId: this.newEventId(),
          }),
        )
        return result
      },
      (result) => ({ payload: { credited: result.credited } }),
    )
  }
}
