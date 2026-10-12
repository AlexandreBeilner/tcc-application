import { describe, expect, it } from 'vitest'
import {
  buildSubscription,
  inferPeriod,
  isActive,
  subscriptionState,
  toStatus,
  willRenew,
  type EntitlementState,
  type Subscription,
} from './subscription'

const NOW = new Date('2026-10-10T12:00:00Z')
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

function entitlement(overrides: Partial<EntitlementState> = {}): EntitlementState {
  return {
    productId: 'pro_monthly',
    store: 'play_store',
    purchasedAt: day(-10),
    expiresAt: day(20),
    graceExpiresAt: null,
    billingIssueDetectedAt: null,
    unsubscribeDetectedAt: null,
    refundedAt: null,
    isSandbox: false,
    managementUrl: 'https://play.google.com/store/account/subscriptions',
    ...overrides,
  }
}

function subscription(overrides: Partial<EntitlementState> = {}): Subscription {
  return buildSubscription('user-1', entitlement(overrides), NOW, null)
}

describe('isActive', () => {
  it.each([
    ['vence no futuro', { expiresAt: day(1) }, true],
    ['venceu ontem', { expiresAt: day(-1) }, false],
    ['sem vencimento (promocional vitalício)', { expiresAt: null }, true],
    ['venceu mas a carência ainda vale', { expiresAt: day(-1), graceExpiresAt: day(2) }, true],
    ['venceu e a carência também', { expiresAt: day(-3), graceExpiresAt: day(-1) }, false],
    ['reembolsado, mesmo com data futura', { expiresAt: day(10), refundedAt: day(-1) }, false],
    [
      'reembolso agendado pro futuro não conta ainda',
      { expiresAt: day(10), refundedAt: day(1) },
      true,
    ],
    ['vence exatamente agora', { expiresAt: NOW }, false],
  ] as const)('%s', (_label, overrides, expected) => {
    expect(isActive(subscription(overrides), NOW)).toBe(expected)
  })
})

describe('subscriptionState', () => {
  it('sem linha é "none"', () => {
    expect(subscriptionState(null, NOW)).toBe('none')
  })

  it('ativa dentro do período', () => {
    expect(subscriptionState(subscription(), NOW)).toBe('active')
  })

  it('falha de cobrança ainda dentro do período segue "active"', () => {
    expect(subscriptionState(subscription({ billingIssueDetectedAt: day(-1) }), NOW)).toBe('active')
  })

  it('falha de cobrança passada do vencimento, na carência, é "billing_issue"', () => {
    const sub = subscription({
      expiresAt: day(-1),
      graceExpiresAt: day(3),
      billingIssueDetectedAt: day(-1),
    })
    expect(subscriptionState(sub, NOW)).toBe('billing_issue')
  })

  it('vencida é "expired"', () => {
    expect(subscriptionState(subscription({ expiresAt: day(-5) }), NOW)).toBe('expired')
  })
})

describe('willRenew', () => {
  it('renova quando ativa e sem cancelamento', () => {
    expect(willRenew(subscription(), NOW)).toBe(true)
  })

  it.each([
    ['cancelou (ainda ativa até vencer)', { unsubscribeDetectedAt: day(-2) }],
    ['falha de cobrança', { billingIssueDetectedAt: day(-1) }],
    ['promocional', { store: 'promotional' as const }],
    ['sem vencimento', { expiresAt: null }],
    ['vencida', { expiresAt: day(-1) }],
  ])('não renova: %s', (_label, overrides) => {
    expect(willRenew(subscription(overrides), NOW)).toBe(false)
  })
})

describe('inferPeriod', () => {
  it.each([
    ['30 dias é mensal', day(-0), day(30), 'play_store', false, 'monthly'],
    ['365 dias é anual', day(0), day(365), 'app_store', false, 'annual'],
    [
      '5 minutos de sandbox é desconhecido',
      day(0),
      new Date(day(0).getTime() + 300_000),
      'app_store',
      true,
      'unknown',
    ],
    ['promocional é desconhecido', day(0), day(30), 'promotional', false, 'unknown'],
    ['duração estranha é desconhecida', day(0), day(100), 'stripe', false, 'unknown'],
  ] as const)('%s', (_label, from, to, store, sandbox, expected) => {
    expect(inferPeriod(from, to, store, sandbox)).toBe(expected)
  })

  it('sem datas é desconhecido', () => {
    expect(inferPeriod(null, null, 'stripe', false)).toBe('unknown')
  })
})

describe('toStatus', () => {
  it('sem assinatura devolve free', () => {
    expect(toStatus(null, NOW)).toEqual({
      isPro: false,
      state: 'none',
      plan: null,
      store: null,
      expiresAt: null,
      willRenew: false,
      managementUrl: null,
    })
  })

  it('assinatura ativa devolve PRO com o destino de gerenciamento', () => {
    const status = toStatus(subscription(), NOW)
    expect(status).toMatchObject({
      isPro: true,
      state: 'active',
      plan: 'monthly',
      store: 'play_store',
      willRenew: true,
      managementUrl: 'https://play.google.com/store/account/subscriptions',
    })
    expect(status.expiresAt).toBe(day(20).toISOString())
  })

  it('cancelada mas ainda dentro do período continua PRO, sem renovar', () => {
    const status = toStatus(subscription({ unsubscribeDetectedAt: day(-1) }), NOW)
    expect(status.isPro).toBe(true)
    expect(status.willRenew).toBe(false)
  })

  it('vencida não é PRO mas mantém o dado do plano pra tela', () => {
    const status = toStatus(subscription({ expiresAt: day(-2) }), NOW)
    expect(status).toMatchObject({ isPro: false, state: 'expired', store: 'play_store' })
  })

  it('em carência de pagamento ainda é PRO', () => {
    const status = toStatus(
      subscription({ expiresAt: day(-1), graceExpiresAt: day(2), billingIssueDetectedAt: day(-1) }),
      NOW,
    )
    expect(status).toMatchObject({ isPro: true, state: 'billing_issue' })
  })
})
