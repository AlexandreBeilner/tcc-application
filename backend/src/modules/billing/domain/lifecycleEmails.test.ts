import { describe, expect, it } from 'vitest'
import { lifecycleEmails, RESUBSCRIBE_AFTER_MS } from './lifecycleEmails'
import { buildSubscription } from './subscription'
import { NOW, day, entitlement } from '../test/fixtures'

const build = (overrides: Parameters<typeof entitlement>[0] = {}) =>
  buildSubscription('u1', entitlement(overrides), NOW, null)

describe('lifecycleEmails (MO.3.4)', () => {
  it('primeira assinatura: boas-vindas, com a chave do fato', () => {
    const emails = lifecycleEmails(null, build(), NOW)

    expect(emails).toEqual([
      { kind: 'welcome', key: `pro-welcome:u1:${day(-10).getTime()}`, plan: 'monthly' },
    ])
  })

  it('renovação não manda boas-vindas de novo', () => {
    const before = build({ purchasedAt: day(-40), expiresAt: day(-10) })
    // o webhook de renovação atrasou: a projeção anterior já estava vencida há 10 dias? não: 10 dias > 7
    expect(lifecycleEmails(before, build(), NOW)).toHaveLength(1)

    const lateRenewal = build({ purchasedAt: day(-30), expiresAt: day(-1) })
    expect(lifecycleEmails(lateRenewal, build(), NOW)).toEqual([])
    const stillActive = build({ purchasedAt: day(-20), expiresAt: day(5) })
    expect(lifecycleEmails(stillActive, build(), NOW)).toEqual([])
  })

  it('volta depois de mais de 7 dias sem PRO: boas-vindas de novo', () => {
    const old = build({
      purchasedAt: day(-60),
      expiresAt: new Date(NOW.getTime() - RESUBSCRIBE_AFTER_MS - 1),
    })

    expect(lifecycleEmails(old, build(), NOW).map((e) => e.kind)).toEqual(['welcome'])
  })

  it('falha de cobrança nova avisa uma vez, com o destino da loja', () => {
    const issueAt = day(-1)
    const prev = build({ store: 'play_store' })
    const next = build({
      store: 'play_store',
      billingIssueDetectedAt: issueAt,
      graceExpiresAt: day(5),
    })

    const emails = lifecycleEmails(prev, next, NOW)
    expect(emails).toEqual([
      {
        kind: 'billing_issue',
        key: `pro-billing-issue:u1:${issueAt.getTime()}`,
        store: 'play_store',
        manageUrl: 'https://play.google.com/store/account/subscriptions',
      },
    ])
    // sincronizar de novo com a mesma falha não repete
    expect(lifecycleEmails(next, next, NOW)).toEqual([])
  })

  it('usa o link do provedor quando existe e nenhum quando a loja não tem destino', () => {
    const withUrl = build({
      billingIssueDetectedAt: day(-1),
      managementUrl: 'https://portal.example/x',
    })
    const noUrl = build({ billingIssueDetectedAt: day(-1) })

    expect(lifecycleEmails(build(), withUrl, NOW)[0]).toMatchObject({
      manageUrl: 'https://portal.example/x',
    })
    expect(lifecycleEmails(build(), noUrl, NOW)[0]).toMatchObject({ manageUrl: null })
  })

  it('assinatura encerrada avisa, com chave do fim do período', () => {
    const prev = build()
    const next = build({ expiresAt: day(-1) })

    expect(lifecycleEmails(prev, next, NOW)).toEqual([
      { kind: 'ended', key: `pro-ended:u1:${day(-1).getTime()}` },
    ])
  })

  it('quem nunca tinha assinatura gravada não recebe "encerrada"', () => {
    expect(lifecycleEmails(null, build({ expiresAt: day(-30) }), NOW)).toEqual([])
  })
})
