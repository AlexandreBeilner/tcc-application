import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { IntegrityAlreadyRunningError } from '../../domain/errors'
import type {
  GetIntegrityRunUseCase,
  StartIntegrityCheckUseCase,
} from '../../application/useCases/integrity'

export interface AdminIntegrityRouterDeps {
  startIntegrityCheck: StartIntegrityCheckUseCase
  getIntegrityRun: GetIntegrityRunUseCase
  authMiddleware: AuthMiddleware
}

// Integridade financeira (Fase N, tarefa N.21): proxy fino do motor, que reconstrói saldo e
// posição dos eventos e compara com a projeção. Somente leitura (nunca corrige) e em segundo
// plano: POST abre e responde 202, GET devolve a última. Não pede senha recente: não altera nada.
export function createAdminIntegrityRouter(deps: AdminIntegrityRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]

  router.post('/admin/integrity/check', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      res.status(202).json(await deps.startIntegrityCheck.execute(req.auth.userId))
    } catch (err) {
      if (err instanceof IntegrityAlreadyRunningError) {
        res.status(409).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.get('/admin/integrity/check', ...adminOnly, async (_req, res) => {
    res.status(200).json({ run: await deps.getIntegrityRun.execute() })
  })

  return router
}
