import { describe, expect, it } from 'vitest'
import type { EnqueueEmailInput } from '../../../notifications/application/useCases/enqueueEmail'
import { createNotificationsAccountMailer } from './notificationsAccountMailer'

function setup() {
  const enqueued: EnqueueEmailInput[] = []
  const mailer = createNotificationsAccountMailer({
    enqueueEmail: {
      async execute(input) {
        enqueued.push(input)
        return { status: 'enqueued', id: 'x' }
      },
    },
  })
  return { enqueued, mailer }
}

const who = { userId: 'u1', to: 'ana@exemplo.com', name: 'Ana' }

describe('notificationsAccountMailer', () => {
  it('boas-vindas: transacional e uma por conta, qualquer que seja o caminho de verificação', async () => {
    const { enqueued, mailer } = setup()

    await mailer.sendWelcome(who)

    expect(enqueued[0]).toMatchObject({
      templateKey: 'welcome',
      category: 'transactional',
      idempotencyKey: 'welcome:u1',
    })
  })

  it('suspensão e reativação são segurança (nunca opcionais) e idempotentes por evento', async () => {
    const { enqueued, mailer } = setup()

    await mailer.sendAccountSuspended({ ...who, reason: 'spam', eventId: 'e1' })
    await mailer.sendAccountReactivated({ ...who, eventId: 'e2' })

    expect(enqueued[0]).toMatchObject({
      templateKey: 'account_suspended',
      category: 'security',
      payload: { name: 'Ana', reason: 'spam' },
      idempotencyKey: 'account-suspended:e1',
    })
    expect(enqueued[1]).toMatchObject({
      templateKey: 'account_reactivated',
      category: 'security',
      idempotencyKey: 'account-reactivated:e2',
    })
  })

  it('exclusão é segurança e não leva dado pessoal no payload do outbox', async () => {
    const { enqueued, mailer } = setup()

    await mailer.sendAccountDeleted({ userId: 'u1', to: 'ana@exemplo.com', eventId: 'u1' })

    expect(enqueued[0]).toMatchObject({
      templateKey: 'account_deleted',
      category: 'security',
      payload: {},
      idempotencyKey: 'account-deleted:u1',
    })
  })

  it('exportação e ajuste são transacionais', async () => {
    const { enqueued, mailer } = setup()

    await mailer.sendDataExported({ ...who, eventId: 'e1' })
    await mailer.sendAccountAdjusted({ ...who, summary: 'R$ 50,00 creditados.', eventId: 'e2' })

    expect(enqueued.map((e) => [e.templateKey, e.category, e.idempotencyKey])).toEqual([
      ['data_exported', 'transactional', 'data-exported:e1'],
      ['account_adjusted', 'transactional', 'account-adjusted:e2'],
    ])
  })
})
