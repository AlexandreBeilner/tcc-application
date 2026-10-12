import type { RecipientDirectory } from '../../../notifications/application/ports/recipientDirectory'
import type { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import type { ResultMailer } from '../../application/ports/resultPublishers'

export interface NotificationsResultMailerOptions {
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute' | 'acceptsOptional'>
  recipients: RecipientDirectory
}

// Liga a port `ResultMailer` ao módulo `notifications` (MO.6.7). Categoria `social`: só sai para
// quem ligou o e-mail social (desligado por padrão). Idempotente por assembleia e pessoa:
// `assembly-result:<assembleia>:<usuário>`, então reprocessar o fechamento nunca manda dois. O
// texto é o mesmo para quem votou e para quem não votou: nunca cobra participação.
export function createNotificationsResultMailer(
  options: NotificationsResultMailerOptions,
): ResultMailer {
  return {
    async sendResult(userId, result) {
      if (!(await options.enqueueEmail.acceptsOptional(userId, 'social'))) return
      const recipient = await options.recipients.find(userId)
      if (!recipient) return

      await options.enqueueEmail.execute({
        userId,
        to: recipient.address,
        templateKey: 'assembly_result',
        category: 'social',
        payload: {
          name: recipient.name,
          assemblyId: result.assemblyId,
          companyName: result.subjectLabel,
          title: result.title,
          outcome: result.outcome,
          reason: result.reason,
          ...(result.winningLabel ? { winningLabel: result.winningLabel } : {}),
        },
        idempotencyKey: `assembly-result:${result.assemblyId}:${userId}`,
      })
    },
  }
}
