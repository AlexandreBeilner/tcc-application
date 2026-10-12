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
      transactionalFrom: 'Plataforma <no-reply@localhost>',
      newsFrom: 'Plataforma <no-reply@localhost>',
      replyTo: undefined,
      delayBetweenSendsMs: 500,
      outboxIntervalMs: 5_000,
      engagementIntervalMs: 900_000,
      streakReminderEnabled: true,
    })
  })

  const RESEND_ENV = {
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY_TRANSACTIONAL: 're_send',
    RESEND_API_KEY_NEWS: 're_news',
    EMAIL_FROM_TRANSACTIONAL: 'Selucra <no-reply@send.exemplo.com>',
    EMAIL_FROM_NEWS: 'Selucra <no-reply@news.exemplo.com>',
  }

  it('resend sem chaves ou remetentes derruba a subida listando tudo que falta', () => {
    expect(() => loadEmailConfig({ EMAIL_PROVIDER: 'resend' })).toThrow(
      /RESEND_API_KEY_TRANSACTIONAL.*RESEND_API_KEY_NEWS.*EMAIL_FROM_TRANSACTIONAL.*EMAIL_FROM_NEWS/,
    )
    expect(() => loadEmailConfig({ ...RESEND_ENV, RESEND_API_KEY_NEWS: '   ' })).toThrow(
      /RESEND_API_KEY_NEWS/,
    )
  })

  it('recusa a mesma chave nos dois fluxos', () => {
    expect(() => loadEmailConfig({ ...RESEND_ENV, RESEND_API_KEY_NEWS: 're_send' })).toThrow(
      /não podem ser a mesma chave/,
    )
  })

  it('resend completo', () => {
    expect(
      loadEmailConfig({
        ...RESEND_ENV,
        EMAIL_REPLY_TO: 'suporte@exemplo.com',
        RESEND_WEBHOOK_SECRET: 'whsec_1',
        EMAIL_SEND_RPS: '4',
        EMAIL_OUTBOX_INTERVAL_MS: '2000',
      }),
    ).toEqual({
      provider: 'resend',
      transactional: { apiKey: 're_send', from: 'Selucra <no-reply@send.exemplo.com>' },
      news: { apiKey: 're_news', from: 'Selucra <no-reply@news.exemplo.com>' },
      replyTo: 'suporte@exemplo.com',
      webhookSecret: 'whsec_1',
      delayBetweenSendsMs: 250,
      outboxIntervalMs: 2_000,
      engagementIntervalMs: 900_000,
      streakReminderEnabled: true,
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

  it('o lembrete de sequência nasce ligado e só desliga com EMAIL_STREAK_REMINDER=off', () => {
    const base = { EMAIL_PROVIDER: 'log' }

    expect(loadEmailConfig(base).streakReminderEnabled).toBe(true)
    expect(loadEmailConfig({ ...base, EMAIL_STREAK_REMINDER: 'on' }).streakReminderEnabled).toBe(
      true,
    )
    expect(loadEmailConfig({ ...base, EMAIL_STREAK_REMINDER: 'OFF' }).streakReminderEnabled).toBe(
      false,
    )
  })
})
