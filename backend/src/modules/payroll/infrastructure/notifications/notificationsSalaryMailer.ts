import type { RecipientDirectory } from '../../../notifications/application/ports/recipientDirectory'
import type { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import type { SalaryMailer } from '../../application/ports/salaryMailer'

export interface NotificationsSalaryMailerOptions {
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute' | 'acceptsOptional'>
  recipients: RecipientDirectory
}

// Liga a port `SalaryMailer` ao módulo `notifications` (EM.7.2, E11). Categoria `engagement`:
// só sai para quem ligou. Idempotente por mês: a chave usa o último mês creditado
// (`salary:<usuário>:<YYYY-MM>`), então repetir a rodada nunca manda dois e-mails. O valor é o
// do próprio destinatário (nunca de outro usuário, RNF09).
export function createNotificationsSalaryMailer(
  options: NotificationsSalaryMailerOptions,
): SalaryMailer {
  return {
    async sendSalaryCredited({ userId, monthKeys, amountPerMonth }) {
      const lastMonth = monthKeys[monthKeys.length - 1]
      if (!lastMonth) return
      if (!(await options.enqueueEmail.acceptsOptional(userId, 'engagement'))) return
      const recipient = await options.recipients.find(userId)
      if (!recipient) return

      await options.enqueueEmail.execute({
        userId,
        to: recipient.address,
        templateKey: 'salary_credited',
        category: 'engagement',
        payload: {
          name: recipient.name,
          firstMonth: monthKeys[0],
          lastMonth,
          months: monthKeys.length,
          amountPerMonth,
        },
        idempotencyKey: `salary:${userId}:${lastMonth}`,
      })
    },
  }
}
