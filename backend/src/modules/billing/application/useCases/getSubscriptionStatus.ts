import { toStatus, type Subscription, type SubscriptionStatus } from '../../domain/subscription'
import type { SubscriptionCache } from '../ports/subscriptionCache'
import type { SubscriptionRepository } from '../ports/subscriptionRepository'

// Único ponto de consulta de "esta pessoa é PRO?". Toda feature gateada passa por aqui (direto ou
// pelo `ProAccessGuard`), nunca por claim de JWT: um cancelamento ou reembolso tem de valer antes
// de o token expirar.
export class GetSubscriptionStatusUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly cache: SubscriptionCache,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string): Promise<SubscriptionStatus> {
    return toStatus(await this.load(userId), this.now())
  }

  private async load(userId: string): Promise<Subscription | null> {
    const cached = await this.cache.get(userId)
    if (cached) return cached.subscription

    const subscription = await this.subscriptions.find(userId)
    await this.cache.set(userId, { subscription })
    return subscription
  }
}
