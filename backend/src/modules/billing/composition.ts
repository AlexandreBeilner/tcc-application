import type { Redis } from 'ioredis'
import type { Database } from '../../db/client'
import type { EnqueueEmailUseCase } from '../notifications/application/useCases/enqueueEmail'
import { createDrizzleRecipientDirectory } from '../notifications/infrastructure/persistence/drizzleRecipientDirectory'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import { ProAccessGuard } from './application/proAccessGuard'
import { GetSubscriptionStatusUseCase } from './application/useCases/getSubscriptionStatus'
import { ListActiveProUserIdsUseCase } from './application/useCases/listActiveProUserIds'
import { HandleBillingWebhookUseCase } from './application/useCases/handleBillingWebhook'
import { ReconcileSubscriptionsUseCase } from './application/useCases/reconcileSubscriptions'
import { SyncSubscriptionUseCase } from './application/useCases/syncSubscription'
import { createNotificationsBillingMailer } from './infrastructure/notifications/notificationsBillingMailer'
import { createRedisSubscriptionCache } from './infrastructure/cache/redisSubscriptionCache'
import type { BillingConfig } from './infrastructure/config/billingConfig'
import { createDrizzleBillingUserLookup } from './infrastructure/persistence/drizzleBillingUserLookup'
import { createDrizzleBillingWebhookEventLog } from './infrastructure/persistence/drizzleBillingWebhookEventLog'
import { createDrizzleReconciliationAudience } from './infrastructure/persistence/drizzleReconciliationAudience'
import { createDrizzleSubscriptionRepository } from './infrastructure/persistence/drizzleSubscriptionRepository'
import { createDisabledEntitlementProvider } from './infrastructure/revenuecat/disabledEntitlementProvider'
import { createRevenueCatEntitlementProvider } from './infrastructure/revenuecat/revenueCatEntitlementProvider'
import { createWebhookAuthorizer } from './infrastructure/revenuecat/webhookAuthorization'
import { createBillingRouter } from './interfaces/http/billingRouter'

export interface BillingCoreDeps {
  db: Database
  redis: Redis
  config: BillingConfig
  // Avisos do ciclo de vida do PRO (MO.3.4) entram no outbox do módulo `notifications`.
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute'>
}

export interface BillingCompositionDeps extends BillingCoreDeps {
  authMiddleware: AuthMiddleware
}

// Casos de uso e adapters, sem HTTP. Os adapters são sem estado, então `app.ts` (rotas) e
// `server.ts` (job de reconciliação) montam cada um o seu sobre o mesmo banco.
function createBillingCore(deps: BillingCoreDeps) {
  const subscriptions = createDrizzleSubscriptionRepository(deps.db)
  const cache = createRedisSubscriptionCache(deps.redis)

  const provider =
    deps.config.provider === 'revenuecat'
      ? createRevenueCatEntitlementProvider({
          secretKey: deps.config.secretKey,
          entitlementId: deps.config.entitlementId,
          apiBaseUrl: deps.config.apiBaseUrl,
          requestTimeoutMs: deps.config.requestTimeoutMs,
        })
      : createDisabledEntitlementProvider()

  const getSubscriptionStatus = new GetSubscriptionStatusUseCase(subscriptions, cache)
  const syncSubscription = new SyncSubscriptionUseCase(
    provider,
    subscriptions,
    cache,
    createNotificationsBillingMailer({
      enqueueEmail: deps.enqueueEmail,
      recipients: createDrizzleRecipientDirectory(deps.db),
    }),
  )
  const handleWebhook = new HandleBillingWebhookUseCase(
    createDrizzleBillingWebhookEventLog(deps.db),
    createDrizzleBillingUserLookup(deps.db),
    syncSubscription,
  )
  const reconcileSubscriptions = new ReconcileSubscriptionsUseCase(
    createDrizzleReconciliationAudience(deps.db),
    syncSubscription,
  )
  const listActiveProUserIds = new ListActiveProUserIdsUseCase(subscriptions)
  return {
    getSubscriptionStatus,
    syncSubscription,
    handleWebhook,
    reconcileSubscriptions,
    listActiveProUserIds,
  }
}

// Job de reconciliação (`server.ts`): só existe com o provedor ligado, senão não há o que reconsultar.
export function createBillingReconciliation(deps: BillingCoreDeps) {
  return createBillingCore(deps).reconcileSubscriptions
}

// Composição do módulo `billing` (único lugar que instancia os adapters concretos). Devolve o
// router e as peças que OUTROS módulos usam: `proAccessGuard` pra gatear feature PRO e
// `getSubscriptionStatus` pra leituras de plano. Com `BILLING_PROVIDER=disabled` ninguém é PRO e
// o webhook responde 503, mas o resto do app funciona igual.
export function createBillingModule(deps: BillingCompositionDeps) {
  const core = createBillingCore(deps)

  const router = createBillingRouter({
    getSubscriptionStatus: core.getSubscriptionStatus,
    authMiddleware: deps.authMiddleware,
    webhook:
      deps.config.provider === 'revenuecat'
        ? {
            handle: core.handleWebhook,
            isAuthorized: createWebhookAuthorizer(deps.config.webhookAuthorization),
          }
        : undefined,
  })

  return {
    router,
    getSubscriptionStatus: core.getSubscriptionStatus,
    syncSubscription: core.syncSubscription,
    listActiveProUserIds: core.listActiveProUserIds,
    proAccessGuard: new ProAccessGuard(core.getSubscriptionStatus),
  }
}
