import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetActiveUsersUseCase } from '../../application/useCases/getActiveUsers'
import type { GetMilestoneTimesUseCase } from '../../application/useCases/getMilestoneTimes'
import type { GetRetentionCohortsUseCase } from '../../application/useCases/getRetentionCohorts'
import { retentionQuerySchema } from './schemas'

export interface AdminRetentionRouterDeps {
  getRetentionCohorts: GetRetentionCohortsUseCase
  getActiveUsers: GetActiveUsersUseCase
  getMilestoneTimes: GetMilestoneTimesUseCase
  authMiddleware: AuthMiddleware
}

// Painel de retenção (RT.1.2): só números agregados, nenhuma lista de pessoas (RP4). Só leitura,
// por isso não passa pela auditoria (mesma regra de `GET /admin/overview`).
export function createAdminRetentionRouter(deps: AdminRetentionRouterDeps): Router {
  const router = Router()

  router.get(
    '/admin/retention',
    deps.authMiddleware.authenticate,
    deps.authMiddleware.requireRole('admin'),
    async (req, res) => {
      const parsed = retentionQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({
          error: 'parâmetros do painel de retenção inválidos',
          details: z.flattenError(parsed.error),
        })
        return
      }
      const { weeks, days } = parsed.data
      const [cohorts, active, milestones] = await Promise.all([
        deps.getRetentionCohorts.execute({ weeks }),
        deps.getActiveUsers.execute({ days }),
        deps.getMilestoneTimes.execute({ weeks }),
      ])
      res.status(200).json({ cohorts, active, milestones })
    },
  )

  return router
}
