import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { ListFeedForUserUseCase } from '../../application/useCases/listFeedForUser'

export interface SocialFeedRouterDeps {
  listFeedForUser: ListFeedForUserUseCase
  authMiddleware: AuthMiddleware
}

export function createSocialFeedRouter(deps: SocialFeedRouterDeps): Router {
  const router = Router()

  router.get('/social-feed', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const events = await deps.listFeedForUser.execute({ userId: req.auth.userId })
    res.status(200).json({ events })
  })

  return router
}
