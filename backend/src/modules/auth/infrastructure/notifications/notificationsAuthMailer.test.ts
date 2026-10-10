import { describe, expect, it } from 'vitest'
import type { EnqueueEmailInput } from '../../../notifications/application/useCases/enqueueEmail'
import { createNotificationsAuthMailer } from './notificationsAuthMailer'

function setup() {
  const enqueued: EnqueueEmailInput[] = []
  const mailer = createNotificationsAuthMailer({
    appUrl: 'https://app.exemplo.com/',
    enqueueEmail: {
      async execute(input) {
        enqueued.push(input)
        return { status: 'enqueued', id: 'x' }
      },
    },
  })
  return { enqueued, mailer }
}

describe('notificationsAuthMailer', () => {
  it('monta o link de verificação com o token no fragmento e enfileira como segurança', async () => {
    const { enqueued, mailer } = setup()

    await mailer.sendEmailVerification({
      userId: 'u1',
      to: 'ana@exemplo.com',
      name: 'Ana',
      token: 'abc123',
      tokenId: 't1',
      expiresAt: new Date(),
    })

    expect(enqueued).toEqual([
      {
        userId: 'u1',
        to: 'ana@exemplo.com',
        templateKey: 'email_verification',
        category: 'security',
        payload: {
          name: 'Ana',
          verifyUrl: 'https://app.exemplo.com/verificar-email#token=abc123',
          expiresInHours: 24,
        },
        idempotencyKey: 'email-verification:t1',
      },
    ])
  })

  it('monta o link de reset com o token no fragmento e enfileira como segurança', async () => {
    const { enqueued, mailer } = setup()

    await mailer.sendPasswordReset({
      userId: 'u1',
      to: 'ana@exemplo.com',
      name: 'Ana',
      token: 'abc123',
      tokenId: 't1',
      expiresAt: new Date(),
    })

    expect(enqueued).toEqual([
      {
        userId: 'u1',
        to: 'ana@exemplo.com',
        templateKey: 'password_reset',
        category: 'security',
        payload: {
          name: 'Ana',
          resetUrl: 'https://app.exemplo.com/redefinir-senha#token=abc123',
          expiresInMinutes: 30,
        },
        idempotencyKey: 'password-reset:t1',
      },
    ])
  })

  it('aviso de senha alterada não carrega token e é idempotente por evento', async () => {
    const { enqueued, mailer } = setup()

    await mailer.sendPasswordChanged({
      userId: 'u1',
      to: 'ana@exemplo.com',
      name: 'Ana',
      eventId: 't1',
    })

    expect(enqueued[0]).toMatchObject({
      templateKey: 'password_changed',
      category: 'security',
      idempotencyKey: 'password-changed:t1',
    })
    expect(JSON.stringify(enqueued[0].payload)).not.toContain('token')
  })
})
