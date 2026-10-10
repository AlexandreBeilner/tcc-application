import type { BillingUserLookup } from '../ports/billingUserLookup'
import type { BillingWebhookEventLog } from '../ports/billingWebhookEventLog'
import type { SyncSubscriptionUseCase } from './syncSubscription'

// O que o webhook do RevenueCat traz que interessa (o router valida e entrega isto já limpo).
export interface BillingWebhookEvent {
  id: string
  type: string
  occurredAt: Date | null
  // Todos os ids que o evento menciona (app_user_id, original_app_user_id, aliases e, em TRANSFER,
  // transferred_from/transferred_to). Ids anônimos do RevenueCat são descartados aqui.
  appUserIds: string[]
}

export type BillingWebhookOutcome = 'duplicate' | 'ignored' | 'synced'

// Eventos que podem ter mudado o direito ao PRO. Os demais (TEST, experimento, moeda virtual, ...)
// são registrados e ignorados. Qualquer um destes só dispara a reconsulta, então a lista é
// conservadora: tratar um evento a mais custa uma consulta, tratar um a menos deixa o plano velho.
export const SYNC_EVENT_TYPES: ReadonlySet<string> = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_PAUSED',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED',
  'TRANSFER',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'PURCHASE_REDEEMED',
  'SUBSCRIBER_ALIAS',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Trata um aviso do RevenueCat. O evento é só um aviso: o efeito é reconsultar o estado atual de
// cada usuário envolvido (`SyncSubscriptionUseCase`). Se o processamento falha no meio, o erro
// sobe, o RevenueCat reenvia e a reconsulta converge; o registro do evento só é gravado no fim.
export class HandleBillingWebhookUseCase {
  constructor(
    private readonly log: BillingWebhookEventLog,
    private readonly users: BillingUserLookup,
    private readonly sync: SyncSubscriptionUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(event: BillingWebhookEvent): Promise<BillingWebhookOutcome> {
    if (await this.log.wasProcessed(event.id)) return 'duplicate'

    if (!SYNC_EVENT_TYPES.has(event.type)) {
      await this.log.record(event.id, event.type, this.now())
      return 'ignored'
    }

    const candidates = [...new Set(event.appUserIds.map((id) => id.toLowerCase()))].filter((id) =>
      UUID.test(id),
    )
    const userIds = candidates.length > 0 ? await this.users.existingUserIds(candidates) : []

    for (const userId of userIds) {
      await this.sync.execute(userId, { lastEventAt: event.occurredAt })
    }

    await this.log.record(event.id, event.type, this.now())
    return 'synced'
  }
}
