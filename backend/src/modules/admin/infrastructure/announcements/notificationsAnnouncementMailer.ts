import type { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import type { AnnouncementMailer } from '../../application/ports/announcementBroadcast'

// Liga o lote de comunicado ao outbox. Categoria `transactional`: aviso operacional crítico não
// é opcional (EM.6.1 não o desliga). Um e-mail por (comunicado, usuário).
export function createNotificationsAnnouncementMailer(options: {
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute'>
}): AnnouncementMailer {
  return {
    async send({ recipient, announcement, sendAt }) {
      await options.enqueueEmail.execute({
        userId: recipient.userId,
        to: recipient.email,
        templateKey: 'announcement',
        category: 'transactional',
        payload: {
          name: recipient.name,
          title: announcement.title,
          body: announcement.body,
          kind: announcement.kind,
          startsAt: announcement.startsAt.toISOString(),
          endsAt: announcement.endsAt?.toISOString() ?? null,
        },
        idempotencyKey: `announcement:${announcement.id}:${recipient.userId}`,
        sendAt,
      })
    },
  }
}
