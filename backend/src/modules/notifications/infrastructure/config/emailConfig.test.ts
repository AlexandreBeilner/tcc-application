import { describe, expect, it } from 'vitest'
import { loadEmailConfig } from './emailConfig'

describe('loadEmailConfig', () => {
  it('exige EMAIL_PROVIDER explícito', () => {
    expect(() => loadEmailConfig({})).toThrow(/EMAIL_PROVIDER/)
    expect(() => loadEmailConfig({ EMAIL_PROVIDER: 'smtp' })).toThrow(/EMAIL_PROVIDER/)
  })

  it('log não precisa de chave e usa os padrões', () => {
    expect(loadEmailConfig({ EMAIL_PROVIDER: 'log' })).toEqual({
      provider: 'log',
      from: 'Plataforma <no-reply@localhost>',
      replyTo: undefined,
      delayBetweenSendsMs: 500,
      outboxIntervalMs: 5_000,
      engagementIntervalMs: 900_000,
      streakReminderEnabled: false,
    })
  })

  it('resend sem chave ou sem remetente derruba a subida listando tudo que falta', () => {
    expect(() => loadEmailConfig({ EMAIL_PROVIDER: 'resend' })).toThrow(
      /RESEND_API_KEY.*EMAIL_FROM/,
    )
    expect(() =>
      loadEmailConfig({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: '   ', EMAIL_FROM: 'a@b.com' }),
    ).toThrow(/RESEND_API_KEY/)
  })

  it('resend completo', () => {
    expect(
      loadEmailConfig({
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_123',
        EMAIL_FROM: 'Plataforma <no-reply@mail.exemplo.com>',
        EMAIL_REPLY_TO: 'ajuda@exemplo.com',
        RESEND_WEBHOOK_SECRET: 'whsec_1',
        EMAIL_SEND_RPS: '4',
        EMAIL_OUTBOX_INTERVAL_MS: '2000',
      }),
    ).toEqual({
      provider: 'resend',
      apiKey: 're_123',
      from: 'Plataforma <no-reply@mail.exemplo.com>',
      replyTo: 'ajuda@exemplo.com',
      webhookSecret: 'whsec_1',
      delayBetweenSendsMs: 250,
      outboxIntervalMs: 2_000,
      engagementIntervalMs: 900_000,
      streakReminderEnabled: false,
    })
  })

  it.each(['0', '-1', 'abc'])('rejeita EMAIL_SEND_RPS=%s', (value) => {
    expect(() => loadEmailConfig({ EMAIL_PROVIDER: 'log', EMAIL_SEND_RPS: value })).toThrow(
      /EMAIL_SEND_RPS/,
    )
  })

  it('arredonda a pausa pra cima (3 envios por segundo => 334 ms)', () => {
    expect(
      loadEmailConfig({ EMAIL_PROVIDER: 'log', EMAIL_SEND_RPS: '3' }).delayBetweenSendsMs,
    ).toBe(334)
  })

  it('o lembrete de sequência nasce desligado e só liga com EMAIL_STREAK_REMINDER=on', () => {
    const base = { EMAIL_PROVIDER: 'log' }

    expect(loadEmailConfig(base).streakReminderEnabled).toBe(false)
    expect(loadEmailConfig({ ...base, EMAIL_STREAK_REMINDER: 'off' }).streakReminderEnabled).toBe(
      false,
    )
    expect(loadEmailConfig({ ...base, EMAIL_STREAK_REMINDER: 'ON' }).streakReminderEnabled).toBe(
      true,
    )
  })
})
