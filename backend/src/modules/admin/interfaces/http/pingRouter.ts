import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'

// Rota de exemplo pra validar o controle de acesso por papel (RNF07) —
// painéis administrativos reais (ex: eventos macro, RF14) chegam nas
// tarefas 4.4/6.x, reaproveitando este mesmo authMiddleware.
export function createAdminPingRouter(authMiddleware: AuthMiddleware): Router {
  const router = Router()

  router.get(
    '/admin/ping',
    authMiddleware.authenticate,
    authMiddleware.requireRole('admin'),
    (_req, res) => {
      res.status(200).json({ ok: true })
    },
  )

  return router
}
