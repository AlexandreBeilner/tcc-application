import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetProgressionUseCase } from '../../application/useCases/getProgression'

export interface ProgressionRouterDeps {
  getProgression: GetProgressionUseCase
  authMiddleware: AuthMiddleware
}

export function createProgressionRouter(deps: ProgressionRouterDeps): Router {
  const router = Router()

  router.get('/me/progression', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const progression = await deps.getProgression.execute({ userId: req.auth.userId })
    res.status(200).json(progression)
  })

  // Público: nível/xp nunca são o dado protegido por RNF09 — só patrimônio
  // absoluto é.
  router.get('/users/:id/progression', async (req, res) => {
    const progression = await deps.getProgression.execute({ userId: req.params.id })
    res.status(200).json(progression)
  })

  return router
}
