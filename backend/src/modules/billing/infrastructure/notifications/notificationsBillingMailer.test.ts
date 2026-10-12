import { describe, expect, it } from 'vitest'
import type { EnqueueEmailInput } from '../../../notifications/application/useCases/enqueueEmail'
import { createNotificationsBillingMailer } from './notificationsBillingMailer'

function setup(
  recipient: { address: string; name?: string } | null = {
    address: 'ana@exemplo.com',
    name: 'Ana',
  },
) {
  const enqueued: EnqueueEmailInput[] = []
  const mailer = createNotificationsBillingMailer({
    enqueueEmail: {
      async execute(input) {
        enqueued.push(input)
        return { status: 'enqueued', id: 'x' }
      },
    },
    recipients: {
      async find() {
        return recipient ? { ...recipient, status: 'active', emailVerified: true } : null
      },
    },
  })
  return { enqueued, mailer }
}

describe('notificationsBillingMailer (MO.3.4)', () => {
  it('boas-vindas: transacional, idempotente pela chave do fato', async () => {
    const { enqueued, mailer } = setup()

    await mailer.send('u1', { kind: 'welcome', key: 'pro-welcome:u1:1', plan: 'annual' })

    expect(enqueued[0]).toMatchObject({
      userId: 'u1',
      to: 'ana@exemplo.com',
      templateKey: 'pro_welcome',
      category: 'transactional',
      payload: { name: 'Ana', plan: 'annual' },
      idempotencyKey: 'pro-welcome:u1:1',
    })
  })

  it('problema de cobrança leva o nome da loja e o destino certo', async () => {
    const { enqueued, mailer } = setup()

    await mailer.send('u1', {
      kind: 'billing_issue',
      key: 'k',
      store: 'play_store',
      manageUrl: 'https://play.google.com/store/account/subscriptions',
    })

    expect(enqueued[0]).toMatchObject({
      templateKey: 'pro_billing_issue',
      payload: {
        storeLabel: 'Google Play',
        manageUrl: 'https://play.google.com/store/account/subscriptions',
      },
    })
  })

  it('encerramento usa o template certo e não carrega dado de cobrança', async () => {
    const { enqueued, mailer } = setup()

    await mailer.send('u1', { kind: 'ended', key: 'pro-ended:u1:1' })

    expect(enqueued[0]).toMatchObject({ templateKey: 'pro_ended', payload: { name: 'Ana' } })
  })

  it('conta desconhecida não gera e-mail', async () => {
    const { enqueued, mailer } = setup(null)

    await mailer.send('u1', { kind: 'ended', key: 'k' })

    expect(enqueued).toEqual([])
  })
})
