import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { GetAdminOverviewUseCase } from '../../application/useCases/getAdminOverview'
import type { GetSystemHealthUseCase } from '../../application/useCases/getSystemHealth'

export interface AdminSystemRouterDeps {
  getSystemHealth: GetSystemHealthUseCase
  getAdminOverview: GetAdminOverviewUseCase
  authMiddleware: AuthMiddleware
}

// Visão geral do painel (Fase N, tarefa N.5): saúde dos componentes e o resumo de
// mercado, agenda e produto. Só leitura, por isso não passa pela auditoria (N.4).
export function createAdminSystemRouter(deps: AdminSystemRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]

  router.get('/admin/system/health', ...adminOnly, async (_req, res) => {
    res.status(200).json(await deps.getSystemHealth.execute())
  })

  router.get('/admin/overview', ...adminOnly, async (_req, res) => {
    res.status(200).json(await deps.getAdminOverview.execute())
  })

  return router
}
