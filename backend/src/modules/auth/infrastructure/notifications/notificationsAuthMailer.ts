import type { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import type { AuthMailer } from '../../application/ports/authMailer'
import { EMAIL_TOKEN_TTL_MS } from '../../domain/emailToken'

export interface NotificationsAuthMailerOptions {
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute'>
  // URL pública do frontend (`FRONTEND_URL`).
  appUrl: string
}

// Liga a port `AuthMailer` ao módulo `notifications` (o `auth` não conhece o outbox). Monta o
// link com o token no fragmento (`#token=`): o fragmento não vai ao servidor, ao `Referer` nem
// ao log do gateway.
export function createNotificationsAuthMailer(options: NotificationsAuthMailerOptions): AuthMailer {
  const appUrl = options.appUrl.replace(/\/+$/, '')
  return {
    async sendPasswordReset(mail) {
      await options.enqueueEmail.execute({
        userId: mail.userId,
        to: mail.to,
        templateKey: 'password_reset',
        category: 'security',
        payload: {
          name: mail.name,
          resetUrl: `${appUrl}/redefinir-senha#token=${mail.token}`,
          expiresInMinutes: EMAIL_TOKEN_TTL_MS.password_reset / 60_000,
        },
        idempotencyKey: `password-reset:${mail.tokenId}`,
      })
    },

    async sendPasswordChanged(mail) {
      await options.enqueueEmail.execute({
        userId: mail.userId,
        to: mail.to,
        templateKey: 'password_changed',
        category: 'security',
        payload: { name: mail.name },
        idempotencyKey: `password-changed:${mail.eventId}`,
      })
    },
  }
}
