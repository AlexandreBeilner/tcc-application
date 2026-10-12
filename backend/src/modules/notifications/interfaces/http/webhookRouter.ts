import express, { Router } from 'express'
import { InvalidWebhookSignatureError } from '../../domain/errors'
import type { ReceiveProviderWebhookUseCase } from '../../application/useCases/receiveProviderWebhook'

export interface EmailWebhookRouterDeps {
  receiveProviderWebhook: ReceiveProviderWebhookUseCase
}

// `POST /webhooks/resend`. Precisa do corpo BRUTO (a assinatura cobre os bytes), então este router
// usa `express.raw` próprio e tem de ser montado ANTES do `express.json()` global em `app.ts`. Sem
// JWT: a autenticação é a assinatura. Assinatura inválida => 400 e nada é processado; evento que
// não interessa => 200 (senão o provedor reenviaria pra sempre); erro nosso => 500 (o provedor
// reenvia, e o processamento é idempotente).
export function createEmailWebhookRouter(deps: EmailWebhookRouterDeps): Router {
  const router = Router()

  router.post(
    '/resend',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      const id = req.header('svix-id')
      const timestamp = req.header('svix-timestamp')
      const signature = req.header('svix-signature')
      if (!id || !timestamp || !signature || !Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: 'webhook sem assinatura' })
        return
      }

      try {
        const handled = await deps.receiveProviderWebhook.execute({
          rawBody: req.body.toString('utf8'),
          headers: { id, timestamp, signature },
        })
        res.status(200).json({ received: true, handled })
      } catch (err) {
        if (err instanceof InvalidWebhookSignatureError) {
          res.status(400).json({ error: 'assinatura inválida' })
          return
        }
        console.error('e-mail: erro ao processar webhook', err)
        res.status(500).json({ error: 'erro ao processar o webhook' })
      }
    },
  )

  return router
}
