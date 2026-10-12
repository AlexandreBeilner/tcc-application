import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type {
  GetRetrospectiveUseCase,
  ListRetrospectiveMonthsUseCase,
} from '../../application/useCases/getRetrospective'
import { RetrospectiveNotAvailableError } from '../../domain/errors'

export interface RetrospectivesRouterDeps {
  listMonths: ListRetrospectiveMonthsUseCase
  getRetrospective: GetRetrospectiveUseCase
  authMiddleware: AuthMiddleware
}

export function createRetrospectivesRouter(deps: RetrospectivesRouterDeps): Router {
  const router = Router()

  router.get('/retrospectives', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    res.status(200).json(await deps.listMonths.execute(req.auth.userId))
  })

  router.get('/retrospectives/:month', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      const retrospective = await deps.getRetrospective.execute(
        req.auth.userId,
        req.params.month as string,
      )
      res.status(200).json({ retrospective })
    } catch (err) {
      if (err instanceof RetrospectiveNotAvailableError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
