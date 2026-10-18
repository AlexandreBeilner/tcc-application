import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  LessonNotCompletedTodayError,
  DailyNotCompletedTodayError,
  MicroDecisionStreakNotReachedError,
  MissionNotFoundError,
  OldLessonNotReviewedTodayError,
} from '../../domain/errors'
import type { CompleteMissionUseCase } from '../../application/useCases/completeMission'
import type { ListDailyMissionsUseCase } from '../../application/useCases/listDailyMissions'

export interface MissionsRouterDeps {
  listDailyMissions: ListDailyMissionsUseCase
  completeMission: CompleteMissionUseCase
  authMiddleware: AuthMiddleware
}

export function createMissionsRouter(deps: MissionsRouterDeps): Router {
  const router = Router()

  router.get('/missions', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const missions = await deps.listDailyMissions.execute({ userId: req.auth.userId })
    res.status(200).json({ missions })
  })

  router.post('/missions/:id/complete', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      const result = await deps.completeMission.execute({
        userId: req.auth.userId,
        // Express 5 infere `params` como `string | string[]` com mais de um
        // handler nesta rota (authMiddleware + handler) — `:id` nunca
        // repete segmento aqui, então é sempre string em tempo de execução.
        missionId: req.params.id as string,
      })
      res.status(200).json(result)
    } catch (err) {
      if (err instanceof MissionNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      if (
        err instanceof LessonNotCompletedTodayError ||
        err instanceof OldLessonNotReviewedTodayError ||
        err instanceof MicroDecisionStreakNotReachedError ||
        err instanceof DailyNotCompletedTodayError
      ) {
        res.status(422).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
