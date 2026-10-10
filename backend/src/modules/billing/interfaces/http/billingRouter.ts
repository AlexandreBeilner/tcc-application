import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetSubscriptionStatusUseCase } from '../../application/useCases/getSubscriptionStatus'
import type {
  BillingWebhookEvent,
  HandleBillingWebhookUseCase,
} from '../../application/useCases/handleBillingWebhook'
import type { DevSubscriptionUseCase } from '../../application/useCases/devSubscription'
import { devPurchaseBodySchema, webhookBodySchema, type WebhookBody } from './schemas'

export interface BillingRouterDeps {
  getSubscriptionStatus: GetSubscriptionStatusUseCase
  authMiddleware: AuthMiddleware
  // Sem isto a cobrança está desligada (`BILLING_PROVIDER=disabled`): o webhook responde 503 e o
  // status devolve `billingEnabled: false`, pra o frontend esconder a compra.
  // Compra falsa do app em desenvolvimento (`BILLING_PROVIDER=dev`). Ausente em qualquer outro modo:
  // as rotas `/billing/dev/*` nem existem (404).
  dev?: DevSubscriptionUseCase
  webhook?: {
    handle: HandleBillingWebhookUseCase
    // Confere o cabeçalho `Authorization` do RevenueCat em tempo constante.
    isAuthorized: (authorizationHeader: string | undefined) => boolean
  }
}

function toEvent(body: WebhookBody): BillingWebhookEvent {
  const { event } = body
  const ids = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
    ...(event.transferred_from ?? []),
    ...(event.transferred_to ?? []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0)
  return {
    id: event.id,
    type: event.type,
    occurredAt: event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : null,
    appUserIds: ids,
  }
}

export function createBillingRouter(deps: BillingRouterDeps): Router {
  const router = Router()

  // Plano da própria pessoa. Só o necessário pra tela; nada de dado de cobrança além disso.
  router.get('/billing/status', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const status = await deps.getSubscriptionStatus.execute(req.auth.userId)
    res.status(200).json({ ...status, billingEnabled: deps.webhook !== undefined || deps.dev !== undefined })
  })

  // `POST /billing/webhook`: sem JWT, autenticado pelo cabeçalho que configuramos no RevenueCat.
  // 200 também pra evento repetido ou irrelevante (senão o RevenueCat reenviaria); erro nosso ou do
  // provedor => 500 (ele reenvia 5 vezes e o processamento é convergente).
  router.post('/billing/webhook', async (req, res) => {
    if (!deps.webhook) {
      res.status(503).json({ error: 'cobrança desligada neste ambiente' })
      return
    }
    if (!deps.webhook.isAuthorized(req.header('authorization'))) {
      res.status(401).json({ error: 'não autorizado' })
      return
    }

    const parsed = webhookBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'corpo inválido' })
      return
    }

    try {
      const outcome = await deps.webhook.handle.execute(toEvent(parsed.data))
      res.status(200).json({ received: true, outcome })
    } catch (err) {
      console.error('cobrança: erro ao processar webhook', err)
      res.status(500).json({ error: 'erro ao processar o webhook' })
    }
  })

  if (deps.dev) {
    const dev = deps.dev
    router.post('/billing/dev/purchase', deps.authMiddleware.authenticate, async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }
      const parsed = devPurchaseBodySchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'corpo inválido' })
        return
      }
      await dev.purchase(req.auth.userId, parsed.data.plan, parsed.data.store)
      res.status(204).end()
    })

    router.delete('/billing/dev/subscription', deps.authMiddleware.authenticate, async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }
      await dev.cancel(req.auth.userId)
      res.status(204).end()
    })
  }

  return router
}
