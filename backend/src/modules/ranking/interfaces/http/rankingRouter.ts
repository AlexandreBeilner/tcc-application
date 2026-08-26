import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetRankingUseCase } from '../../application/useCases/getRanking'
import { rankingQuerySchema } from './schemas'

export interface RankingRouterDeps {
  getRanking: GetRankingUseCase
  authMiddleware: AuthMiddleware
}

export function createRankingRouter(deps: RankingRouterDeps): Router {
  const router = Router()

  router.get('/ranking', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = rankingQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'parâmetros inválidos', details: z.flattenError(parsed.error) })
      return
    }

    const result = await deps.getRanking.execute({
      window: parsed.data.window,
      scope: parsed.data.scope,
      requestingUserId: req.auth.userId,
    })
    res.status(200).json(result)
  })

  return router
}
