import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { Response } from 'express'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  InvalidMacroEventError,
  MacroEventConflictError,
  MacroEventNotFoundError,
} from '../../domain/errors'
import type { CancelMacroEventUseCase } from '../../application/useCases/cancelMacroEvent'
import type { GetMacroEventDetailUseCase } from '../../application/useCases/getMacroEventDetail'
import type { TriggerMacroEventUseCase } from '../../application/useCases/triggerMacroEvent'
import type { ListMacroEventsUseCase } from '../../application/useCases/listMacroEvents'
import {
  listMacroEventsQuerySchema,
  macroEventDetailQuerySchema,
  triggerMacroEventBodySchema,
} from './schemas'

export interface AdminMacroEventsRouterDeps {
  triggerMacroEvent: TriggerMacroEventUseCase
  listMacroEvents: ListMacroEventsUseCase
  getMacroEventDetail: GetMacroEventDetailUseCase
  cancelMacroEvent: CancelMacroEventUseCase
  authMiddleware: AuthMiddleware
}

export function createAdminMacroEventsRouter(deps: AdminMacroEventsRouterDeps): Router {
  const router = Router()
  router.param('id', requireUuidParam)

  router.post(
    '/admin/macro-events',
    deps.authMiddleware.authenticate,
    deps.authMiddleware.requireRole('admin'),
    async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }

      const parsed = triggerMacroEventBodySchema.safeParse(req.body)
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'dados do evento macro inválidos', details: z.flattenError(parsed.error) })
        return
      }

      try {
        const event = await deps.triggerMacroEvent.execute(req.auth.userId, parsed.data)
        res.status(201).json({ event })
      } catch (err) {
        if (err instanceof InvalidMacroEventError) {
          res.status(400).json({ error: err.message })
          return
        }
        throw err
      }
    },
  )

  router.get(
    '/admin/macro-events',
    deps.authMiddleware.authenticate,
    deps.authMiddleware.requireRole('admin'),
    async (req, res) => {
      const parsed = listMacroEventsQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({
          error: 'parâmetros de paginação inválidos',
          details: z.flattenError(parsed.error),
        })
        return
      }

      // O painel enxerga tudo (cancelado e agendado incluídos); o feed do usuário não passa
      // `view` e o motor assume a visão pública.
      const result = await deps.listMacroEvents.execute({ ...parsed.data, view: 'admin' })
      res.status(200).json(result)
    },
  )

  router.get(
    '/admin/macro-events/:id',
    deps.authMiddleware.authenticate,
    deps.authMiddleware.requireRole('admin'),
    async (req, res) => {
      const parsed = macroEventDetailQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({
          error: 'janela do impacto inválida',
          details: z.flattenError(parsed.error),
        })
        return
      }
      try {
        const detail = await deps.getMacroEventDetail.execute(
          req.params.id as string,
          parsed.data.window_days,
        )
        res.status(200).json(detail)
      } catch (err) {
        sendMacroEventError(err, res)
      }
    },
  )

  router.delete(
    '/admin/macro-events/:id',
    deps.authMiddleware.authenticate,
    deps.authMiddleware.requireRole('admin'),
    async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }
      try {
        const event = await deps.cancelMacroEvent.execute(req.auth.userId, req.params.id as string)
        res.status(200).json({ event })
      } catch (err) {
        sendMacroEventError(err, res)
      }
    },
  )

  return router
}

function sendMacroEventError(err: unknown, res: Response): void {
  if (err instanceof MacroEventNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }
  if (err instanceof MacroEventConflictError) {
    res.status(409).json({ error: err.message })
    return
  }
  throw err
}
