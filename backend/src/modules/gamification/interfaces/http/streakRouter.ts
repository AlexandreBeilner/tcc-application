import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetProgressionUseCase } from '../../application/useCases/getProgression'

export interface StreakRouterDeps {
  getProgression: GetProgressionUseCase
  authMiddleware: AuthMiddleware
}

export function createStreakRouter(deps: StreakRouterDeps): Router {
  const router = Router()

  // Sem caso de uso próprio: só extrai os campos de streak da progressão já
  // lida por GetProgressionUseCase — delegação simples sem regra de negócio
  // (ver .claude/arquitetura-backend-ddd-lite.md).
  router.get('/me/streak', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const progression = await deps.getProgression.execute({ userId: req.auth.userId })
    res.status(200).json({
      currentStreak: progression.currentStreak,
      longestStreak: progression.longestStreak,
    })
  })

  return router
}
