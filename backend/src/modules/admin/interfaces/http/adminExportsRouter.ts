import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { ExportCsvUseCase } from '../../application/useCases/exportCsv'
import { exportDatasetParamSchema, exportQuerySchema } from './schemas'

export interface AdminExportsRouterDeps {
  exportCsv: ExportCsvUseCase
  authMiddleware: AuthMiddleware
}

// Exportação CSV (Fase N, tarefa N.21): usuários, ordens, eventos de mercado e auditoria, com
// período e teto de linhas. Sempre auditada. O arquivo de usuários traz e-mail (dado pessoal),
// então pede senha recente; os outros conjuntos identificam a conta só pelo id.
export function createAdminExportsRouter(deps: AdminExportsRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  const recentAuth = deps.authMiddleware.requireRecentAuth()

  router.get(
    '/admin/exports/:dataset',
    ...adminOnly,
    // `:dataset` ainda não foi validado aqui; só `users` exige a senha recente.
    (req, res, next) => (req.params.dataset === 'users' ? recentAuth(req, res, next) : next()),
    async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }
      const dataset = exportDatasetParamSchema.safeParse(req.params.dataset)
      const query = exportQuerySchema.safeParse(req.query)
      if (!dataset.success || !query.success) {
        res.status(400).json({
          error: 'parâmetros da exportação inválidos',
          details: query.success ? undefined : z.flattenError(query.error),
        })
        return
      }

      const { from, to, limit } = query.data
      const result = await deps.exportCsv.execute(
        req.auth.userId,
        dataset.data,
        { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
        limit,
      )
      res
        .status(200)
        .setHeader('Content-Type', 'text/csv; charset=utf-8')
        .setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
        .setHeader('X-Export-Rows', String(result.rows))
        .setHeader('X-Export-Truncated', String(result.truncated))
        .send(result.csv)
    },
  )

  return router
}
