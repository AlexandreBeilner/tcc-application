import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { TickInProgressError } from '../../domain/errors'
import type { TriggerTickUseCase } from '../../application/useCases/triggerTick'

export interface AdminTickRouterDeps {
  triggerTick: TriggerTickUseCase
  authMiddleware: AuthMiddleware
}

// Proxy admin-only de POST /admin/tick do motor (gap fechado na tarefa
// 7.3: até aqui a rota só existia na rede interna do Compose — ver
// comentário de handleAdminTick em engine/internal/infra/httpserver/admin.go
// — e era chamada manualmente fora do gateway em toda sessão de validação
// anterior). Sem payload — o motor não aceita parâmetro nenhum aqui.
export function createAdminTickRouter(deps: AdminTickRouterDeps): Router {
  const router = Router()

  router.post(
    '/admin/tick',
    deps.authMiddleware.authenticate,
    deps.authMiddleware.requireRole('admin'),
    deps.authMiddleware.requireRecentAuth(),
    async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }

      try {
        const result = await deps.triggerTick.execute(req.auth.userId)
        res.status(200).json(result)
      } catch (err) {
        if (err instanceof TickInProgressError) {
          res.status(409).json({ error: err.message })
          return
        }
        throw err
      }
    },
  )

  return router
}
