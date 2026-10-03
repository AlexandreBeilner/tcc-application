import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  TradingHaltConflictError,
  TradingHaltNotFoundError,
  TradingHaltRejectedError,
} from '../../domain/errors'
import type { LiftTradingHaltUseCase } from '../../application/useCases/liftTradingHalt'
import type { ListTradingHaltsUseCase } from '../../application/useCases/listTradingHalts'
import type { PauseTradingUseCase } from '../../application/useCases/pauseTrading'
import { pauseTradingBodySchema } from './schemas'

export interface AdminHaltsRouterDeps {
  listTradingHalts: ListTradingHaltsUseCase
  pauseTrading: PauseTradingUseCase
  liftTradingHalt: LiftTradingHaltUseCase
  authMiddleware: AuthMiddleware
}

// Pausa de negociação (Fase N, tarefa N.9): lista, pausa (global ou de um ativo) e
// retomada. Proxy fino do motor; pausar e retomar passam pela auditoria (N.4).
export function createAdminHaltsRouter(deps: AdminHaltsRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  router.param('id', requireUuidParam)

  router.get('/admin/halts', ...adminOnly, async (_req, res) => {
    res.status(200).json(await deps.listTradingHalts.execute())
  })

  router.post('/admin/halts', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = pauseTradingBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'dados da pausa inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      const halt = await deps.pauseTrading.execute(req.auth.userId, {
        scope: parsed.data.scope,
        assetId: parsed.data.asset_id,
        reason: parsed.data.reason,
      })
      res.status(201).json(halt)
    } catch (err) {
      sendHaltError(err, res)
    }
  })

  router.post('/admin/halts/:id/lift', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      res
        .status(200)
        .json(await deps.liftTradingHalt.execute(req.auth.userId, req.params.id as string))
    } catch (err) {
      sendHaltError(err, res)
    }
  })

  return router
}

function sendHaltError(err: unknown, res: Response): void {
  if (err instanceof TradingHaltRejectedError) {
    res.status(400).json({ error: err.message })
    return
  }
  if (err instanceof TradingHaltNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }
  if (err instanceof TradingHaltConflictError) {
    res.status(409).json({ error: err.message })
    return
  }
  throw err
}
