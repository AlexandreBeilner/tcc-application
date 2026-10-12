import { describe, expect, it } from 'vitest'
import { buildSubscription } from './subscription'
import {
  buildBillingMetrics,
  clientEventKey,
  isPayingSubscription,
  lifecycleFunnelEvent,
} from './funnel'
import type { FunnelSummary } from './funnel'
import { NOW, day, entitlement } from '../test/fixtures'

const EMPTY: FunnelSummary = {
  steps: {
    lessonCompleted: 0,
    inviteViewed: 0,
    plansOpened: 0,
    purchaseStarted: 0,
    subscribed: 0,
    cancelled: 0,
  },
  bySource: [],
}
const PRICES = { monthlyCents: 1990, annualCents: 19990 }

function sub(userId: string, overrides: Parameters<typeof entitlement>[0] = {}) {
  return buildSubscription(userId, entitlement(overrides), NOW, null)
}

describe('clientEventKey', () => {
  it('é a mesma no mesmo dia (UTC) e muda com o dia, o evento ou a origem', () => {
    const a = clientEventKey('u1', 'invite_viewed', 'league', new Date('2026-10-10T01:00:00Z'))
    expect(clientEventKey('u1', 'invite_viewed', 'league', new Date('2026-10-10T23:00:00Z'))).toBe(
      a,
    )
    expect(
      clientEventKey('u1', 'invite_viewed', 'league', new Date('2026-10-11T00:00:00Z')),
    ).not.toBe(a)
    expect(clientEventKey('u1', 'plans_opened', 'league', NOW)).not.toBe(a)
    expect(clientEventKey('u1', 'invite_viewed', 'duel', NOW)).not.toBe(a)
  })
})

describe('isPayingSubscription', () => {
  it('exclui conta de teste das lojas e concessão promocional', () => {
    expect(isPayingSubscription(sub('u', {}))).toBe(true)
    expect(isPayingSubscription(sub('u', { isSandbox: true }))).toBe(false)
    expect(isPayingSubscription(sub('u', { store: 'promotional' }))).toBe(false)
  })
})

describe('lifecycleFunnelEvent', () => {
  it('boas-vindas viram "assinou" e encerramento vira "cancelou", com a chave do fato', () => {
    const s = sub('u1')
    expect(
      lifecycleFunnelEvent({ kind: 'welcome', key: 'pro-welcome:u1:1', plan: 'monthly' }, s, NOW),
    ).toMatchObject({
      userId: 'u1',
      name: 'subscribed',
      plan: 'monthly',
      dedupeKey: 'subscribed:pro-welcome:u1:1',
    })
    expect(lifecycleFunnelEvent({ kind: 'ended', key: 'pro-ended:u1:2' }, s, NOW)).toMatchObject({
      name: 'cancelled',
      dedupeKey: 'cancelled:pro-ended:u1:2',
    })
  })

  it('falha de cobrança não é evento do funil', () => {
    const email = { kind: 'billing_issue', key: 'k', store: 'stripe', manageUrl: null } as const
    expect(lifecycleFunnelEvent(email, sub('u1'), NOW)).toBeNull()
  })

  it('conta de teste e concessão promocional não geram evento', () => {
    const welcome = { kind: 'welcome', key: 'k', plan: 'monthly' } as const
    expect(lifecycleFunnelEvent(welcome, sub('u1', { isSandbox: true }), NOW)).toBeNull()
    expect(lifecycleFunnelEvent(welcome, sub('u1', { store: 'promotional' }), NOW)).toBeNull()
  })
})

describe('buildBillingMetrics', () => {
  it('conta ativos por plano e ignora vencidos, testes e promocionais', () => {
    const subs = [
      sub('m1'),
      sub('m2'),
      sub('a1', { purchasedAt: day(-10), expiresAt: day(355) }),
      sub('x', { productId: 'x', purchasedAt: day(-1), expiresAt: day(100) }),
      sub('old', { expiresAt: day(-3) }),
      sub('t', { isSandbox: true }),
      sub('p', { store: 'promotional' }),
    ]
    const metrics = buildBillingMetrics({
      subscriptions: subs,
      summary: EMPTY,
      prices: PRICES,
      windowDays: 30,
      now: NOW,
    })
    expect(metrics.subscribers).toEqual({ active: 4, monthly: 2, annual: 1, unknown: 1 })
  })

  it('receita recorrente: mensal pelo preço cheio, anual dividido por 12, plano desconhecido fora', () => {
    const subs = [sub('m1'), sub('m2'), sub('a1', { purchasedAt: day(-10), expiresAt: day(355) })]
    const metrics = buildBillingMetrics({
      subscriptions: subs,
      summary: EMPTY,
      prices: PRICES,
      windowDays: 30,
      now: NOW,
    })
    expect(metrics.recurringRevenueCents).toBe(Math.round(2 * 1990 + 19990 / 12))
  })

  it('sem preços configurados a receita é nula (nunca chuta um valor)', () => {
    const metrics = buildBillingMetrics({
      subscriptions: [sub('m1')],
      summary: EMPTY,
      prices: { monthlyCents: null, annualCents: 19990 },
      windowDays: 30,
      now: NOW,
    })
    expect(metrics.recurringRevenueCents).toBeNull()
  })

  it('churn: cancelamentos sobre quem estava ativo no começo da janela', () => {
    // Hoje 8 ativos, 3 assinaram e 1 cancelou na janela => começou com 8 - 3 + 1 = 6.
    const subs = Array.from({ length: 8 }, (_, i) => sub(`u${i}`))
    const summary: FunnelSummary = {
      ...EMPTY,
      steps: { ...EMPTY.steps, subscribed: 3, cancelled: 1 },
    }
    const { churn } = buildBillingMetrics({
      subscriptions: subs,
      summary,
      prices: PRICES,
      windowDays: 30,
      now: NOW,
    })
    expect(churn).toEqual({ cancelled: 1, startOfWindow: 6, rate: 1 / 6 })
  })

  it('churn sem base de partida é nulo, nunca divide por zero', () => {
    const { churn } = buildBillingMetrics({
      subscriptions: [],
      summary: EMPTY,
      prices: PRICES,
      windowDays: 30,
      now: NOW,
    })
    expect(churn).toEqual({ cancelled: 0, startOfWindow: 0, rate: null })
  })

  it('conversão por ponto: assinaram sobre quem teve contato; sem contato é nula', () => {
    const summary: FunnelSummary = {
      steps: EMPTY.steps,
      bySource: [
        {
          source: 'league',
          reached: 10,
          inviteViewed: 10,
          plansOpened: 4,
          purchaseStarted: 2,
          subscribed: 1,
        },
        {
          source: 'duel',
          reached: 0,
          inviteViewed: 0,
          plansOpened: 0,
          purchaseStarted: 0,
          subscribed: 0,
        },
      ],
    }
    const { bySource } = buildBillingMetrics({
      subscriptions: [],
      summary,
      prices: PRICES,
      windowDays: 30,
      now: NOW,
    })
    expect(bySource.map((r) => r.conversionRate)).toEqual([0.1, null])
  })
})
