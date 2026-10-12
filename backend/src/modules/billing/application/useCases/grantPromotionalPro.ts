import { isActive } from '../../domain/subscription'
import type { PromotionalEntitlementGranter } from '../ports/promotionalEntitlementGranter'
import type { SubscriptionRepository } from '../ports/subscriptionRepository'

// Concessão de PRO promocional (recompensa da indicação, e depois o painel admin). A regra de
// "até quando" fica com quem chama; aqui só se descobre até quando a pessoa já tem acesso, pra
// empilhar a concessão depois dele em vez de sobrepor.
export class GrantPromotionalProUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly granter: PromotionalEntitlementGranter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Fim do acesso PRO de agora (assinatura paga ou concessão anterior); `null` se não é PRO.
  async currentAccessEnd(userId: string): Promise<Date | null> {
    const subscription = await this.subscriptions.find(userId)
    if (!subscription || !isActive(subscription, this.now())) return null
    // Sem vencimento (vitalício) não há o que empilhar: devolve um instante muito distante.
    if (subscription.expiresAt === null) return new Date(8.64e15)
    const grace = subscription.graceExpiresAt
    return grace && grace > subscription.expiresAt ? grace : subscription.expiresAt
  }

  async grantUntil(userId: string, endsAt: Date): Promise<void> {
    await this.granter.grantUntil(userId, endsAt)
  }
}
