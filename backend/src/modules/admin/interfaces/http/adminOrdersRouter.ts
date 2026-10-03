import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  AdminOrderNotCancellableError,
  AdminOrderNotFoundError,
  BatchTooLargeError,
} from '../../domain/errors'
import type { CancelAdminOrderUseCase } from '../../application/useCases/cancelAdminOrder'
import type { CancelAdminOrdersBatchUseCase } from '../../application/useCases/cancelAdminOrdersBatch'
import type { ListAdminOrdersUseCase } from '../../application/useCases/listAdminOrders'
import { cancelOrdersBatchBodySchema, listAdminOrdersQuerySchema } from './schemas'

export interface AdminOrdersRouterDeps {
  listAdminOrders: ListAdminOrdersUseCase
  cancelAdminOrder: CancelAdminOrderUseCase
  cancelAdminOrdersBatch: CancelAdminOrdersBatchUseCase
  authMiddleware: AuthMiddleware
}

// Tela "Ordens" do painel (Fase N, tarefa N.10): busca de ordens e cancelamento por
// intervenção, de uma ordem ou em lote. Proxy fino do motor; os cancelamentos passam
// pela auditoria (N.4). A tela de usuário continua com POST /market/orders/:id/cancel.
export function createAdminOrdersRouter(deps: AdminOrdersRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  router.param('id', requireUuidParam)

  router.get('/admin/orders', ...adminOnly, async (req, res) => {
    const parsed = listAdminOrdersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'filtros de ordens inválidos', details: z.flattenError(parsed.error) })
      return
    }
    res.status(200).json(await deps.listAdminOrders.execute(parsed.data))
  })

  // Registrada antes de /:id/cancel pra "cancel-batch" nunca ser lido como id.
  router.post('/admin/orders/cancel-batch', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = cancelOrdersBatchBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'informe asset_id ou user_id (UUID) para cancelar em lote',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      res.status(200).json(
        await deps.cancelAdminOrdersBatch.execute(req.auth.userId, {
          assetId: parsed.data.asset_id,
          userId: parsed.data.user_id,
        }),
      )
    } catch (err) {
      if (err instanceof BatchTooLargeError) {
        res.status(422).json({
          error: err.message,
          code: 'batch_too_large',
          matched: err.matched,
          max: err.max,
        })
        return
      }
      throw err
    }
  })

  router.post('/admin/orders/:id/cancel', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      await deps.cancelAdminOrder.execute(req.auth.userId, req.params.id as string)
      res.status(204).send()
    } catch (err) {
      if (err instanceof AdminOrderNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      if (err instanceof AdminOrderNotCancellableError) {
        res.status(409).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
