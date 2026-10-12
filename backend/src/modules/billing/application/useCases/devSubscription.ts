import { buildSubscription } from '../../domain/subscription'
import type { SubscriptionStore } from '../../domain/subscription'
import type { FunnelRecorder } from '../ports/funnelRecorder'
import type { SubscriptionCache } from '../ports/subscriptionCache'
import type { SubscriptionRepository } from '../ports/subscriptionRepository'

export type DevPlan = 'monthly' | 'annual'
export type DevStore = Extract<SubscriptionStore, 'app_store' | 'play_store'>

const DAY_MS = 86_400_000
const PERIOD_DAYS: Record<DevPlan, number> = { monthly: 30, annual: 365 }

// Prefixo do `product_id` de toda assinatura gravada aqui: é o que a distingue de uma compra real
// (as lojas nunca emitem um id assim) em consultas e limpezas do banco de desenvolvimento.
export const DEV_PRODUCT_PREFIX = 'dev.fake.'

// "Compra" falsa do app em desenvolvimento (MO.4.1): grava uma assinatura de teste sem passar por
// loja nem RevenueCat. Só é ligada com `BILLING_PROVIDER=dev`, que a configuração recusa em
// produção. Passa pelos mesmos fatos da projeção real, então `GET /billing/status` e o gating
// agem exatamente como numa compra de verdade.
export class DevSubscriptionUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly cache: SubscriptionCache,
    private readonly funnel: FunnelRecorder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async purchase(userId: string, plan: DevPlan, store: DevStore): Promise<void> {
    const at = this.now()
    await this.funnel.record({
      userId,
      name: 'subscribed',
      source: null,
      plan,
      dedupeKey: `dev-subscribed:${userId}:${at.getTime()}`,
      at,
    })
    await this.subscriptions.upsert(
      buildSubscription(
        userId,
        {
          productId: `${DEV_PRODUCT_PREFIX}${plan}`,
          store,
          purchasedAt: at,
          expiresAt: new Date(at.getTime() + PERIOD_DAYS[plan] * DAY_MS),
          graceExpiresAt: null,
          billingIssueDetectedAt: null,
          unsubscribeDetectedAt: null,
          refundedAt: null,
          isSandbox: false,
          managementUrl: null,
        },
        at,
        at,
      ),
    )
    await this.cache.invalidate(userId)
  }

  // Encerra a vigência agora (a linha fica, como no fluxo real). Volta a conta de teste a free.
  async cancel(userId: string): Promise<void> {
    const existing = await this.subscriptions.find(userId)
    if (existing) {
      const at = this.now()
      await this.funnel.record({
        userId,
        name: 'cancelled',
        source: null,
        plan: existing.period,
        dedupeKey: `dev-cancelled:${userId}:${at.getTime()}`,
        at,
      })
      await this.subscriptions.upsert({
        ...existing,
        expiresAt: at,
        graceExpiresAt: null,
        updatedAt: at,
      })
    }
    await this.cache.invalidate(userId)
  }
}
