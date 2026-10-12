import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetMyReferralUseCase } from '../../application/useCases/getMyReferral'

export interface ReferralsRouterDeps {
  getMyReferral: Pick<GetMyReferralUseCase, 'execute'>
  authMiddleware: AuthMiddleware
}

export function createReferralsRouter(deps: ReferralsRouterDeps): Router {
  const router = Router()

  router.get('/me/referral', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    res.status(200).json(await deps.getMyReferral.execute(req.auth.userId))
  })

  return router
}
