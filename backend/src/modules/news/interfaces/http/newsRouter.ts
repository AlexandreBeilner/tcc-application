import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { ListNewsFeedUseCase } from '../../application/useCases/listNewsFeed'
import { newsFeedQuerySchema } from './schemas'

export interface NewsRouterDeps {
  listNewsFeed: ListNewsFeedUseCase
  authMiddleware: AuthMiddleware
}

// RF16 (tela 5.1) — feed de eventos macro pra qualquer usuário autenticado,
// não só o painel administrativo (GET /admin/macro-events, `role: 'admin'`).
// Mesmo caso de uso/formato de resposta do admin, só sem `requireRole`.
export function createNewsRouter(deps: NewsRouterDeps): Router {
  const router = Router()

  router.get('/news', deps.authMiddleware.authenticate, async (req, res) => {
    const parsed = newsFeedQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: 'parâmetros de paginação inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }

    const result = await deps.listNewsFeed.execute(parsed.data)
    res.status(200).json(result)
  })

  return router
}
