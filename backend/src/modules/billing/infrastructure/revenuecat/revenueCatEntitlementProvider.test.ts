import { describe, expect, it, vi } from 'vitest'
import { BillingProviderError } from '../../domain/errors'
import { createRevenueCatEntitlementProvider } from './revenueCatEntitlementProvider'

const USER_ID = '7b0c0e28-2a53-4d3e-9a55-0f5b9d9e4c11'

// Formato conforme a documentação da API v1 (customer info model) do RevenueCat.
function subscriberBody(overrides: Record<string, unknown> = {}) {
  return {
    request_date_ms: 1760000000000,
    subscriber: {
      entitlements: {
        pro: {
          product_identifier: 'pro_annual',
          purchase_date: '2026-10-01T10:00:00Z',
          expires_date: '2027-10-01T10:00:00Z',
          grace_period_expires_date: null,
        },
      },
      subscriptions: {
        pro_annual: {
          store: 'app_store',
          period_type: 'normal',
          is_sandbox: false,
          purchase_date: '2026-10-01T10:00:00Z',
          expires_date: '2027-10-01T10:00:00Z',
          billing_issues_detected_at: null,
          unsubscribe_detected_at: '2026-10-05T08:00:00Z',
          refunded_at: null,
        },
      },
      management_url: 'https://apps.apple.com/account/subscriptions',
      ...overrides,
    },
  }
}

function provider(fetchFn: typeof fetch) {
  return createRevenueCatEntitlementProvider({
    secretKey: 'sk_test_123',
    entitlementId: 'pro',
    apiBaseUrl: 'https://api.revenuecat.com/v1',
    requestTimeoutMs: 1000,
    fetchFn,
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createRevenueCatEntitlementProvider', () => {
  it('chama o endpoint do assinante com a chave secreta e o id codificado', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(subscriberBody()))
    await provider(fetchFn).getEntitlement(USER_ID)

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(`https://api.revenuecat.com/v1/subscribers/${USER_ID}`)
    expect(init.headers.Authorization).toBe('Bearer sk_test_123')
  })

  it('traduz o entitlement ativo (loja, datas, cancelamento e link de gerenciar)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(subscriberBody()))
    const state = await provider(fetchFn).getEntitlement(USER_ID)

    expect(state).toEqual({
      productId: 'pro_annual',
      store: 'app_store',
      purchasedAt: new Date('2026-10-01T10:00:00Z'),
      expiresAt: new Date('2027-10-01T10:00:00Z'),
      graceExpiresAt: null,
      billingIssueDetectedAt: null,
      unsubscribeDetectedAt: new Date('2026-10-05T08:00:00Z'),
      refundedAt: null,
      isSandbox: false,
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    })
  })

  it('sem o entitlement configurado devolve null (nunca assinou)', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(subscriberBody({ entitlements: {}, subscriptions: {}, management_url: null })),
      )
    expect(await provider(fetchFn).getEntitlement(USER_ID)).toBeNull()
  })

  it('entitlement sem entrada em subscriptions (ex.: promocional) vira loja "other" sem quebrar', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(subscriberBody({ subscriptions: {} })))
    const state = await provider(fetchFn).getEntitlement(USER_ID)
    expect(state).toMatchObject({ store: 'other', isSandbox: false, unsubscribeDetectedAt: null })
  })

  it('loja desconhecida vira "other"', async () => {
    const body = subscriberBody()
    body.subscriber.subscriptions.pro_annual.store = 'amazon'
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(body))
    expect((await provider(fetchFn).getEntitlement(USER_ID))?.store).toBe('other')
  })

  it('sem vencimento (expires_date nulo) mantém expiresAt nulo', async () => {
    const body = subscriberBody()
    body.subscriber.entitlements.pro.expires_date = null as unknown as string
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(body))
    expect((await provider(fetchFn).getEntitlement(USER_ID))?.expiresAt).toBeNull()
  })

  it('status 5xx vira BillingProviderError', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 503))
    await expect(provider(fetchFn).getEntitlement(USER_ID)).rejects.toBeInstanceOf(
      BillingProviderError,
    )
  })

  it('falha de rede vira BillingProviderError', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    await expect(provider(fetchFn).getEntitlement(USER_ID)).rejects.toThrow(/inacessível/)
  })

  it('resposta fora do formato vira BillingProviderError', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ foo: 'bar' }))
    await expect(provider(fetchFn).getEntitlement(USER_ID)).rejects.toThrow(/fora do formato/)
  })
})
