import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { ListAuditLogUseCase } from '../../application/useCases/listAuditLog'
import { listAuditLogQuerySchema } from './schemas'

export interface AdminAuditLogRouterDeps {
  listAuditLog: ListAuditLogUseCase
  authMiddleware: AuthMiddleware
}

export function createAdminAuditLogRouter(deps: AdminAuditLogRouterDeps): Router {
  const router = Router()

  router.get(
    '/admin/audit-log',
    deps.authMiddleware.authenticate,
    deps.authMiddleware.requireRole('admin'),
    async (req, res) => {
      const parsed = listAuditLogQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({
          error: 'filtros do log de auditoria inválidos',
          details: z.flattenError(parsed.error),
        })
        return
      }

      const { admin_id, action, result, from, to, limit, offset } = parsed.data
      const { entries, totalEntries } = await deps.listAuditLog.execute({
        adminId: admin_id,
        action,
        result,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        limit,
        offset,
      })

      res.status(200).json({
        entries: entries.map((e) => ({
          id: e.id,
          admin_id: e.adminId,
          admin_username: e.adminUsername ?? null,
          action: e.action,
          target_type: e.targetType,
          target_id: e.targetId ?? null,
          payload: e.payload,
          result: e.result,
          error_message: e.errorMessage ?? null,
          occurred_at: e.occurredAt.toISOString(),
        })),
        total_entries: totalEntries,
      })
    },
  )

  return router
}
