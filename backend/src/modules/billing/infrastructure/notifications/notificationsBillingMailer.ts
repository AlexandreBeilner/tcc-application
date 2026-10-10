import type { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import type { RecipientDirectory } from '../../../notifications/application/ports/recipientDirectory'
import type { BillingMailer } from '../../application/ports/billingMailer'
import type { SubscriptionStore } from '../../domain/subscription'

export interface NotificationsBillingMailerOptions {
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute'>
  recipients: RecipientDirectory
}

const STORE_LABELS: Partial<Record<SubscriptionStore, string>> = {
  app_store: 'App Store',
  play_store: 'Google Play',
}

// Liga a port `BillingMailer` ao módulo `notifications` (MO.3.4). Os três avisos são
// `transactional` (sem opt-out, recibo continua sendo da loja). A chave de idempotência é a do
// FATO (`email.key`), então webhook repetido ou reconciliação não duplica o e-mail. Conta sem
// endereço ou já anonimizada não recebe nada.
export function createNotificationsBillingMailer(
  options: NotificationsBillingMailerOptions,
): BillingMailer {
  return {
    async send(userId, email) {
      const recipient = await options.recipients.find(userId)
      if (!recipient) return

      const base = {
        userId,
        to: recipient.address,
        category: 'transactional' as const,
        idempotencyKey: email.key,
      }

      switch (email.kind) {
        case 'welcome':
          await options.enqueueEmail.execute({
            ...base,
            templateKey: 'pro_welcome',
            payload: { name: recipient.name, plan: email.plan },
          })
          return
        case 'billing_issue':
          await options.enqueueEmail.execute({
            ...base,
            templateKey: 'pro_billing_issue',
            payload: {
              name: recipient.name,
              storeLabel: STORE_LABELS[email.store],
              manageUrl: email.manageUrl,
            },
          })
          return
        case 'ended':
          await options.enqueueEmail.execute({
            ...base,
            templateKey: 'pro_ended',
            payload: { name: recipient.name },
          })
          return
      }
    },
  }
}
