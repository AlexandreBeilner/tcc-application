import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  SchedulerDisabledError,
  TickAdvanceFailedError,
  TickInProgressError,
} from '../../domain/errors'
import type { AdvanceTicksUseCase } from '../../application/useCases/advanceTicks'
import type { GetSchedulerStatusUseCase } from '../../application/useCases/getSchedulerStatus'
import type { ListTicksUseCase } from '../../application/useCases/listTicks'
import type { SetSchedulerPausedUseCase } from '../../application/useCases/setSchedulerPaused'
import { advanceTicksBodySchema, listTicksQuerySchema } from './schemas'

export interface AdminSchedulerRouterDeps {
  getSchedulerStatus: GetSchedulerStatusUseCase
  setSchedulerPaused: SetSchedulerPausedUseCase
  listTicks: ListTicksUseCase
  advanceTicks: AdvanceTicksUseCase
  authMiddleware: AuthMiddleware
}

// Painel de Tempo (Fase N, tarefa N.6): estado da agenda, pausa/retomada,
// histórico de ticks e "avançar N dias". Proxy fino do motor, mesmo padrão de
// adminTickRouter; as ações que mudam estado passam pela auditoria (N.4).
export function createAdminSchedulerRouter(deps: AdminSchedulerRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  // Ação destrutiva: exige senha conferida há pouco (N.22).
  const recentAuth = deps.authMiddleware.requireRecentAuth()

  function setPaused(paused: boolean) {
    return async (req: Request, res: Response) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }
      try {
        res.status(200).json(await deps.setSchedulerPaused.execute(req.auth.userId, paused))
      } catch (err) {
        if (err instanceof SchedulerDisabledError) {
          res.status(409).json({ error: err.message })
          return
        }
        throw err
      }
    }
  }

  router.get('/admin/scheduler', ...adminOnly, async (_req, res) => {
    res.status(200).json(await deps.getSchedulerStatus.execute())
  })

  router.post('/admin/scheduler/pause', ...adminOnly, recentAuth, setPaused(true))
  router.post('/admin/scheduler/resume', ...adminOnly, setPaused(false))

  router.get('/admin/ticks', ...adminOnly, async (req, res) => {
    const parsed = listTicksQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: 'parâmetros de paginação inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    res.status(200).json(await deps.listTicks.execute(parsed.data))
  })

  router.post('/admin/tick/advance', ...adminOnly, recentAuth, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = advanceTicksBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'days precisa ser um inteiro entre 1 e 30',
        details: z.flattenError(parsed.error),
      })
      return
    }

    try {
      res.status(200).json(await deps.advanceTicks.execute(req.auth.userId, parsed.data.days))
    } catch (err) {
      if (err instanceof TickInProgressError) {
        res.status(409).json({ error: err.message })
        return
      }
      if (err instanceof TickAdvanceFailedError) {
        res.status(500).json({ error: err.message, completed_ticks: err.completedTicks })
        return
      }
      throw err
    }
  })

  return router
}
