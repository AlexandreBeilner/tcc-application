import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { InvalidMacroEventError } from '../../domain/errors'
import type { TriggerMacroEventUseCase } from '../../application/useCases/triggerMacroEvent'
import type { ListMacroEventsUseCase } from '../../application/useCases/listMacroEvents'
import { listMacroEventsQuerySchema, triggerMacroEventBodySchema } from './schemas'

export interface AdminMacroEventsRouterDeps {
  triggerMacroEvent: TriggerMacroEventUseCase
  listMacroEvents: ListMacroEventsUseCase
  authMiddleware: AuthMiddleware
}

export function createAdminMacroEventsRouter(deps: AdminMacroEventsRouterDeps): Router {
  const router = Router()

  router.post(
    '/admin/macro-events',
    deps.authMiddleware.authenticate,
    deps.authMiddleware.requireRole('admin'),
    async (req, res) => {
      const parsed = triggerMacroEventBodySchema.safeParse(req.body)
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'dados do evento macro inválidos', details: z.flattenError(parsed.error) })
        return
      }

      try {
        const event = await deps.triggerMacroEvent.execute(parsed.data)
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

      const result = await deps.listMacroEvents.execute(parsed.data)
      res.status(200).json(result)
    },
  )

  return router
}
