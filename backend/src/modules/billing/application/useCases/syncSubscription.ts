import { buildSubscription, isActive } from '../../domain/subscription'
import type { EntitlementProvider } from '../ports/entitlementProvider'
import type { SubscriptionCache } from '../ports/subscriptionCache'
import type { SubscriptionRepository } from '../ports/subscriptionRepository'

// Reconsulta o estado do entitlement no provedor e regrava a projeção local. É o coração do
// módulo: o webhook, a reconciliação e a concessão do admin só disparam isto. Como sempre grava
// "o que o provedor diz agora", é convergente: repetido ou fora de ordem dá o mesmo resultado.
export class SyncSubscriptionUseCase {
  constructor(
    private readonly provider: EntitlementProvider,
    private readonly subscriptions: SubscriptionRepository,
    private readonly cache: SubscriptionCache,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, options: { lastEventAt?: Date | null } = {}): Promise<void> {
    const at = this.now()
    const state = await this.provider.getEntitlement(userId)

    if (state) {
      await this.subscriptions.upsert(
        buildSubscription(userId, state, at, options.lastEventAt ?? null),
      )
    } else {
      // O entitlement sumiu (ex.: transferido pra outra conta). Nunca apaga a linha: encerra a
      // vigência agora, o que mantém o histórico e some o acesso.
      const existing = await this.subscriptions.find(userId)
      if (existing && isActive(existing, at)) {
        await this.subscriptions.upsert({
          ...existing,
          expiresAt: at,
          graceExpiresAt: null,
          updatedAt: at,
          lastEventAt: options.lastEventAt ?? existing.lastEventAt,
        })
      }
    }

    // Depois de gravar: o próximo `GET /billing/status` já enxerga o novo estado.
    await this.cache.invalidate(userId)
  }
}
