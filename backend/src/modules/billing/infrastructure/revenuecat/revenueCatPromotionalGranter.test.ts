import { describe, expect, it, vi } from 'vitest'
import { BillingProviderError } from '../../domain/errors'
import { createRevenueCatPromotionalGranter } from './revenueCatPromotionalGranter'

const base = {
  secretKey: 'sk_test',
  entitlementId: 'pro',
  apiBaseUrl: 'https://api.revenuecat.com/v1',
  requestTimeoutMs: 1000,
}

describe('createRevenueCatPromotionalGranter', () => {
  it('envia o fim em milissegundos pro endpoint promocional e reconsulta depois', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 201 }))
    const afterGrant = vi.fn(async () => {})
    const granter = createRevenueCatPromotionalGranter({
      ...base,
      afterGrant,
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    const endsAt = new Date('2026-11-01T00:00:00Z')

    await granter.grantUntil('user-1', endsAt)

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      'https://api.revenuecat.com/v1/subscribers/user-1/entitlements/pro/promotional',
    )
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test')
    expect(JSON.parse(init.body as string)).toEqual({ end_time_ms: endsAt.getTime() })
    expect(afterGrant).toHaveBeenCalledWith('user-1')
  })

  it('falha com BillingProviderError quando o RevenueCat recusa, sem reconsultar', async () => {
    const afterGrant = vi.fn(async () => {})
    const granter = createRevenueCatPromotionalGranter({
      ...base,
      afterGrant,
      fetchFn: (async () => new Response('x', { status: 500 })) as unknown as typeof fetch,
    })
    await expect(granter.grantUntil('u', new Date())).rejects.toBeInstanceOf(BillingProviderError)
    expect(afterGrant).not.toHaveBeenCalled()
  })

  it('falha com BillingProviderError quando a rede cai', async () => {
    const granter = createRevenueCatPromotionalGranter({
      ...base,
      afterGrant: async () => {},
      fetchFn: (async () => {
        throw new Error('timeout')
      }) as unknown as typeof fetch,
    })
    await expect(granter.grantUntil('u', new Date())).rejects.toBeInstanceOf(BillingProviderError)
  })
})
