import { describe, expect, it } from 'vitest'
import type { EnqueueEmailInput } from '../../../notifications/application/useCases/enqueueEmail'
import { createNotificationsAnnouncementMailer } from './notificationsAnnouncementMailer'

describe('notificationsAnnouncementMailer', () => {
  it('enfileira um e-mail transacional por (comunicado, usuário), com o horário do lote', async () => {
    const enqueued: EnqueueEmailInput[] = []
    const mailer = createNotificationsAnnouncementMailer({
      enqueueEmail: {
        async execute(input) {
          enqueued.push(input)
          return { status: 'enqueued', id: 'x' }
        },
      },
    })
    const sendAt = new Date('2026-10-10T12:00:01Z')

    await mailer.send({
      recipient: { userId: 'u1', email: 'ana@exemplo.com', name: 'Ana' },
      announcement: {
        id: 'an-1',
        title: 'Manutenção',
        body: 'Voltamos logo.',
        severity: 'critical',
        kind: 'maintenance',
        dismissible: false,
        notifyByEmail: true,
        startsAt: new Date('2026-10-10T22:00:00Z'),
        endsAt: null,
        linkedHaltId: null,
        createdBy: 'admin',
        createdAt: new Date(),
        status: 'scheduled',
      },
      sendAt,
    })

    expect(enqueued[0]).toMatchObject({
      userId: 'u1',
      to: 'ana@exemplo.com',
      templateKey: 'announcement',
      category: 'transactional',
      idempotencyKey: 'announcement:an-1:u1',
      sendAt,
      payload: { title: 'Manutenção', kind: 'maintenance', endsAt: null },
    })
  })
})
