import type { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import type { AccountMailer } from '../../application/ports/accountMailer'

export interface NotificationsAccountMailerOptions {
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute'>
}

// Liga a port `AccountMailer` ao módulo `notifications`. Suspensão, reativação e exclusão são
// `security` (nunca opcionais); boas-vindas, exportação e ajuste são `transactional`.
export function createNotificationsAccountMailer(
  options: NotificationsAccountMailerOptions,
): AccountMailer {
  return {
    async sendWelcome(mail) {
      await options.enqueueEmail.execute({
        userId: mail.userId,
        to: mail.to,
        templateKey: 'welcome',
        category: 'transactional',
        payload: { name: mail.name },
        // Um por conta, não importa por qual caminho ela foi verificada.
        idempotencyKey: `welcome:${mail.userId}`,
      })
    },

    async sendAccountSuspended(mail) {
      await options.enqueueEmail.execute({
        userId: mail.userId,
        to: mail.to,
        templateKey: 'account_suspended',
        category: 'security',
        payload: { name: mail.name, reason: mail.reason },
        idempotencyKey: `account-suspended:${mail.eventId}`,
      })
    },

    async sendAccountReactivated(mail) {
      await options.enqueueEmail.execute({
        userId: mail.userId,
        to: mail.to,
        templateKey: 'account_reactivated',
        category: 'security',
        payload: { name: mail.name },
        idempotencyKey: `account-reactivated:${mail.eventId}`,
      })
    },

    async sendAccountDeleted(mail) {
      await options.enqueueEmail.execute({
        userId: mail.userId,
        to: mail.to,
        templateKey: 'account_deleted',
        category: 'security',
        payload: {},
        idempotencyKey: `account-deleted:${mail.eventId}`,
      })
    },

    async sendDataExported(mail) {
      await options.enqueueEmail.execute({
        userId: mail.userId,
        to: mail.to,
        templateKey: 'data_exported',
        category: 'transactional',
        payload: { name: mail.name },
        idempotencyKey: `data-exported:${mail.eventId}`,
      })
    },

    async sendAccountAdjusted(mail) {
      await options.enqueueEmail.execute({
        userId: mail.userId,
        to: mail.to,
        templateKey: 'account_adjusted',
        category: 'transactional',
        payload: { name: mail.name, summary: mail.summary },
        idempotencyKey: `account-adjusted:${mail.eventId}`,
      })
    },
  }
}
