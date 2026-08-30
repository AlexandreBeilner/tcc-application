import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { ListNewsFeedUseCase } from '../../application/useCases/listNewsFeed'
import type { MarkNewsEventAsSeenUseCase } from '../../application/useCases/markNewsEventAsSeen'
import { newsFeedQuerySchema } from './schemas'

export interface NewsRouterDeps {
  listNewsFeed: ListNewsFeedUseCase
  markNewsEventAsSeen: MarkNewsEventAsSeenUseCase
  authMiddleware: AuthMiddleware
}

// RF16 (tela 5.1) — feed de eventos macro pra qualquer usuário autenticado,
// não só o painel administrativo (GET /admin/macro-events, `role: 'admin'`).
// Mesmo caso de uso/formato de resposta do admin, só sem `requireRole`.
export function createNewsRouter(deps: NewsRouterDeps): Router {
  const router = Router()

  router.get('/news', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = newsFeedQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: 'parâmetros de paginação inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }

    const result = await deps.listNewsFeed.execute({ ...parsed.data, userId: req.auth.userId })
    res.status(200).json(result)
  })

  // Tarefa 6.6.2 — marca um evento como visto pro usuário autenticado.
  // Idempotente (reenviar não duplica linha, mesmo padrão de POST
  // /missions/:id/complete): sempre 204, mesmo em reenvio.
  router.post('/news/:id/seen', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    await deps.markNewsEventAsSeen.execute({
      userId: req.auth.userId,
      // Express 5 infere `params` como `string | string[]` com mais de um
      // handler nesta rota (authMiddleware + handler) — `:id` nunca repete
      // segmento aqui, então é sempre string em tempo de execução.
      macroEventId: req.params.id as string,
    })
    res.status(204).send()
  })

  return router
}
