import { describe, expect, it } from 'vitest'
import { BillingDisabledError, BillingProviderError } from '../../../billing/domain/errors'
import { ProGrantProviderError, ProGrantUnavailableError } from '../../domain/errors'
import { createInProcessUserProGrants } from './inProcessUserProGrants'

const status = {
  isPro: true,
  state: 'active' as const,
  plan: 'monthly' as const,
  store: 'stripe' as const,
  expiresAt: '2026-11-01T00:00:00.000Z',
  willRenew: true,
  managementUrl: null,
}

function build(grantError?: Error) {
  const calls: Array<{ userId: string; endsAt: Date }> = []
  const end = new Date('2026-12-01T00:00:00Z')
  const adapter = createInProcessUserProGrants({
    getSubscriptionStatus: { execute: async () => status },
    grantPromotionalPro: {
      currentAccessEnd: async () => end,
      grantUntil: async (userId, endsAt) => {
        if (grantError) throw grantError
        calls.push({ userId, endsAt })
      },
    },
  })
  return { adapter, calls, end }
}

describe('createInProcessUserProGrants', () => {
  it('expõe só o necessário do plano e delega fim de acesso e concessão', async () => {
    const { adapter, calls, end } = build()
    expect(await adapter.statusOf('u1')).toEqual({
      isPro: true,
      state: 'active',
      plan: 'monthly',
      store: 'stripe',
      expiresAt: '2026-11-01T00:00:00.000Z',
    })
    expect(await adapter.currentAccessEnd('u1')).toEqual(end)
    await adapter.grantUntil('u1', end)
    expect(calls).toEqual([{ userId: 'u1', endsAt: end }])
  })

  it('traduz os erros do billing para erros do painel', async () => {
    await expect(
      build(new BillingDisabledError()).adapter.grantUntil('u1', new Date()),
    ).rejects.toThrow(ProGrantUnavailableError)
    await expect(
      build(new BillingProviderError('5xx')).adapter.grantUntil('u1', new Date()),
    ).rejects.toThrow(ProGrantProviderError)
  })

  it('erro desconhecido passa como está', async () => {
    await expect(build(new RangeError('x')).adapter.grantUntil('u1', new Date())).rejects.toThrow(
      RangeError,
    )
  })
})
