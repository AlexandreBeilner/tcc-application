import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import type {
  GetUserProStatusUseCase,
  GrantUserProUseCase,
} from '../../application/useCases/userProGrants'
import {
  AdminCorrectionConflictError,
  AdminUserNotFoundError,
  ProGrantProviderError,
  ProGrantRejectedError,
  ProGrantUnavailableError,
} from '../../domain/errors'
import { grantProBodySchema } from './schemas'

export interface AdminUserProRouterDeps {
  getUserProStatus: GetUserProStatusUseCase
  grantUserPro: GrantUserProUseCase
  authMiddleware: AuthMiddleware
}

// Plano PRO de uma pessoa e concessão promocional pelo painel (MO.2.5). A concessão exige senha
// conferida há pouco, como as outras ações que mexem em conta.
export function createAdminUserProRouter(deps: AdminUserProRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  const recentAuth = deps.authMiddleware.requireRecentAuth()
  router.param('id', requireUuidParam)

  router.get('/admin/users/:id/pro', ...adminOnly, async (req, res) => {
    try {
      const status = await deps.getUserProStatus.execute(String(req.params.id))
      res.status(200).json({
        is_pro: status.isPro,
        state: status.state,
        plan: status.plan,
        store: status.store,
        expires_at: status.expiresAt,
      })
    } catch (err) {
      sendError(err, res)
    }
  })

  router.post('/admin/users/:id/pro-grants', ...adminOnly, recentAuth, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = grantProBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      res.status(400).json({
        error: 'informe o período (1 a 90 dias) e o motivo (5 a 500 caracteres)',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      const result = await deps.grantUserPro.execute(
        req.auth.userId,
        String(req.params.id),
        parsed.data,
      )
      res.status(200).json({
        user_id: String(req.params.id),
        ends_at: result.endsAt.toISOString(),
        previous_access_end: result.previousAccessEnd?.toISOString() ?? null,
      })
    } catch (err) {
      sendError(err, res)
    }
  })

  return router
}

function sendError(err: unknown, res: Response): void {
  if (err instanceof AdminUserNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }
  if (err instanceof AdminCorrectionConflictError) {
    res.status(409).json({ error: err.message })
    return
  }
  if (err instanceof ProGrantRejectedError) {
    res.status(422).json({ error: err.message, code: 'pro_grant_rejected' })
    return
  }
  if (err instanceof ProGrantUnavailableError) {
    res.status(503).json({ error: err.message, code: 'billing_disabled' })
    return
  }
  if (err instanceof ProGrantProviderError) {
    res.status(502).json({ error: err.message, code: 'billing_provider_error' })
    return
  }
  throw err
}
