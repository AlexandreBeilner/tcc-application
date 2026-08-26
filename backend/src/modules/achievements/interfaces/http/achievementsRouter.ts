import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { ListAchievementsUseCase } from '../../application/useCases/listAchievements'

export interface AchievementsRouterDeps {
  listAchievements: ListAchievementsUseCase
  authMiddleware: AuthMiddleware
}

export function createAchievementsRouter(deps: AchievementsRouterDeps): Router {
  const router = Router()

  router.get('/achievements', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const achievements = await deps.listAchievements.execute({ userId: req.auth.userId })
    res.status(200).json({ achievements })
  })

  return router
}
