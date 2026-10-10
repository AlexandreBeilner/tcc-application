import { describe, expect, it } from 'vitest'
import { loadBillingConfig } from './billingConfig'

describe('loadBillingConfig', () => {
  it('sem variável nenhuma, a cobrança fica desligada', () => {
    expect(loadBillingConfig({})).toEqual({ provider: 'disabled' })
  })

  it('"disabled" explícito também desliga', () => {
    expect(loadBillingConfig({ BILLING_PROVIDER: 'disabled' })).toEqual({ provider: 'disabled' })
  })

  it('revenuecat completo usa os padrões de entitlement, URL e timeout', () => {
    const config = loadBillingConfig({
      BILLING_PROVIDER: 'revenuecat',
      REVENUECAT_SECRET_KEY: 'sk_test',
      REVENUECAT_WEBHOOK_AUTH: 'Bearer segredo',
    })
    expect(config).toEqual({
      provider: 'revenuecat',
      secretKey: 'sk_test',
      webhookAuthorization: 'Bearer segredo',
      entitlementId: 'pro',
      apiBaseUrl: 'https://api.revenuecat.com/v1',
      requestTimeoutMs: 10_000,
    })
  })

  it('aceita sobrescrever entitlement, URL (sem barra final) e timeout', () => {
    const config = loadBillingConfig({
      BILLING_PROVIDER: 'revenuecat',
      REVENUECAT_SECRET_KEY: 'sk',
      REVENUECAT_WEBHOOK_AUTH: 'x',
      REVENUECAT_ENTITLEMENT_ID: 'premium',
      REVENUECAT_API_BASE_URL: 'https://rc.example.test/v1/',
      REVENUECAT_TIMEOUT_MS: '2500',
    })
    expect(config).toMatchObject({
      entitlementId: 'premium',
      apiBaseUrl: 'https://rc.example.test/v1',
      requestTimeoutMs: 2500,
    })
  })

  it('revenuecat sem chave nem segredo lista os dois problemas', () => {
    expect(() => loadBillingConfig({ BILLING_PROVIDER: 'revenuecat' })).toThrow(
      /REVENUECAT_SECRET_KEY.*REVENUECAT_WEBHOOK_AUTH/,
    )
  })

  it('provedor desconhecido derruba a subida', () => {
    expect(() => loadBillingConfig({ BILLING_PROVIDER: 'stripe' })).toThrow(/BILLING_PROVIDER/)
  })

  it('timeout inválido derruba a subida', () => {
    expect(() =>
      loadBillingConfig({
        BILLING_PROVIDER: 'revenuecat',
        REVENUECAT_SECRET_KEY: 'sk',
        REVENUECAT_WEBHOOK_AUTH: 'x',
        REVENUECAT_TIMEOUT_MS: 'abc',
      }),
    ).toThrow(/REVENUECAT_TIMEOUT_MS/)
  })
})
