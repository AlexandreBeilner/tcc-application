import { Router } from 'express'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import { AdminAssetNotFoundError } from '../../domain/errors'
import type { GetMarketMonitorAssetUseCase } from '../../application/useCases/getMarketMonitorAsset'
import type { ListMarketMonitorUseCase } from '../../application/useCases/listMarketMonitor'

export interface AdminMarketRouterDeps {
  listMarketMonitor: ListMarketMonitorUseCase
  getMarketMonitorAsset: GetMarketMonitorAssetUseCase
  authMiddleware: AuthMiddleware
}

// Monitor do mercado ao vivo (Fase N, tarefa N.8): só leitura, por isso não passa pela
// auditoria (N.4). Proxy fino do motor, mesmo padrão de adminSchedulerRouter.
export function createAdminMarketRouter(deps: AdminMarketRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  router.param('id', requireUuidParam)

  router.get('/admin/market/assets', ...adminOnly, async (_req, res) => {
    res.status(200).json({ assets: await deps.listMarketMonitor.execute() })
  })

  router.get('/admin/market/assets/:id', ...adminOnly, async (req, res) => {
    try {
      res.status(200).json(await deps.getMarketMonitorAsset.execute(req.params.id as string))
    } catch (err) {
      if (err instanceof AdminAssetNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
