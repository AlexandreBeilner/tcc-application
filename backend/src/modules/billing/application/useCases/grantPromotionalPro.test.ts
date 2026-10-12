import { describe, expect, it, vi } from 'vitest'
import { createFakeSubscriptionRepository } from '../../test/fakes/fakes'
import type { Subscription } from '../../domain/subscription'
import { GrantPromotionalProUseCase } from './grantPromotionalPro'

const NOW = new Date('2026-10-11T12:00:00Z')

function subscription(overrides: Partial<Subscription>): Subscription {
  return {
    userId: 'u1',
    productId: 'p',
    store: 'stripe',
    purchasedAt: NOW,
    expiresAt: new Date('2026-11-01T00:00:00Z'),
    graceExpiresAt: null,
    billingIssueDetectedAt: null,
    unsubscribeDetectedAt: null,
    refundedAt: null,
    isSandbox: false,
    managementUrl: null,
    period: 'monthly',
    lastEventAt: null,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('GrantPromotionalProUseCase', () => {
  const granter = { grantUntil: vi.fn(async () => {}) }

  it('devolve nulo pra quem não é PRO', async () => {
    const useCase = new GrantPromotionalProUseCase(
      createFakeSubscriptionRepository(),
      granter,
      () => NOW,
    )
    expect(await useCase.currentAccessEnd('u1')).toBeNull()
  })

  it('devolve o vencimento de quem é PRO e nulo se já venceu', async () => {
    const active = subscription({})
    const expired = subscription({ userId: 'u2', expiresAt: new Date('2026-10-01T00:00:00Z') })
    const useCase = new GrantPromotionalProUseCase(
      createFakeSubscriptionRepository([active, expired]),
      granter,
      () => NOW,
    )
    expect(await useCase.currentAccessEnd('u1')).toEqual(active.expiresAt)
    expect(await useCase.currentAccessEnd('u2')).toBeNull()
  })

  it('usa a carência quando ela vai além do vencimento', async () => {
    const grace = new Date('2026-11-05T00:00:00Z')
    const useCase = new GrantPromotionalProUseCase(
      createFakeSubscriptionRepository([
        subscription({ expiresAt: new Date('2026-10-11T11:00:00Z'), graceExpiresAt: grace }),
      ]),
      granter,
      () => NOW,
    )
    expect(await useCase.currentAccessEnd('u1')).toEqual(grace)
  })

  it('delega a concessão ao provedor', async () => {
    const useCase = new GrantPromotionalProUseCase(
      createFakeSubscriptionRepository(),
      granter,
      () => NOW,
    )
    const endsAt = new Date('2026-12-01T00:00:00Z')
    await useCase.grantUntil('u1', endsAt)
    expect(granter.grantUntil).toHaveBeenCalledWith('u1', endsAt)
  })
})
