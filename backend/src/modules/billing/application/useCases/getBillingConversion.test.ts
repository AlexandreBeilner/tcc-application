import { describe, expect, it } from 'vitest'
import { buildSubscription } from '../../domain/subscription'
import type { FunnelSummary } from '../../domain/funnel'
import { createFakeSubscriptionRepository } from '../../test/fakes/fakes'
import { NOW, entitlement } from '../../test/fixtures'
import { GetBillingConversionUseCase } from './getBillingConversion'

const SUMMARY: FunnelSummary = {
  steps: {
    lessonCompleted: 9,
    inviteViewed: 5,
    plansOpened: 3,
    purchaseStarted: 2,
    subscribed: 1,
    cancelled: 0,
  },
  bySource: [],
}

describe('GetBillingConversionUseCase', () => {
  it('junta a projeção de assinaturas com o resumo do funil na janela pedida', async () => {
    const since: Date[] = []
    const useCase = new GetBillingConversionUseCase(
      createFakeSubscriptionRepository([buildSubscription('u1', entitlement(), NOW, null)]),
      { summarize: async (s) => (since.push(s), SUMMARY) },
      { monthlyCents: 1990, annualCents: 19990 },
      () => NOW,
    )

    const metrics = await useCase.execute(7)

    expect(since[0]).toEqual(new Date(NOW.getTime() - 7 * 86_400_000))
    expect(metrics).toMatchObject({
      windowDays: 7,
      subscribers: { active: 1, monthly: 1 },
      recurringRevenueCents: 1990,
      funnel: SUMMARY.steps,
    })
  })
})
