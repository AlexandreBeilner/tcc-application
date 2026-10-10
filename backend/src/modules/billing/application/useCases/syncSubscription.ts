import { lifecycleEmails } from '../../domain/lifecycleEmails'
import { buildSubscription, isActive } from '../../domain/subscription'
import type { Subscription } from '../../domain/subscription'
import type { BillingMailer } from '../ports/billingMailer'
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
    private readonly mailer: BillingMailer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, options: { lastEventAt?: Date | null } = {}): Promise<void> {
    const at = this.now()
    const state = await this.provider.getEntitlement(userId)
    const existing = await this.subscriptions.find(userId)

    let next: Subscription | null = null
    if (state) {
      next = buildSubscription(userId, state, at, options.lastEventAt ?? null)
    } else if (existing && isActive(existing, at)) {
      // O entitlement sumiu (ex.: transferido pra outra conta). Nunca apaga a linha: encerra a
      // vigência agora, o que mantém o histórico e some o acesso.
      next = {
        ...existing,
        expiresAt: at,
        graceExpiresAt: null,
        updatedAt: at,
        lastEventAt: options.lastEventAt ?? existing.lastEventAt,
      }
    }

    if (next) {
      // Os avisos entram no outbox ANTES de gravar a projeção: se o envio falhar, nada foi gravado
      // e o provedor reenvia o webhook (a transição ainda é detectável). Já enfileirar e depois
      // falhar ao gravar só repete a mesma chave, que o outbox ignora.
      for (const email of lifecycleEmails(existing, next, at)) {
        await this.mailer.send(userId, email)
      }
      await this.subscriptions.upsert(next)
    }

    // Depois de gravar: o próximo `GET /billing/status` já enxerga o novo estado.
    await this.cache.invalidate(userId)
  }
}
