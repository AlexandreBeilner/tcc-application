import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  AdminAccountProtectedError,
  AdminUserNotFoundError,
  DeleteConfirmationMismatchError,
  UserStatusConflictError,
} from '../../domain/errors'
import type { AdminUserSummary } from '../../domain/adminUser'
import type { AdminUserDetail } from '../../application/useCases/getAdminUserDetail'
import type { DeleteUserAccountUseCase } from '../../application/useCases/deleteUserAccount'
import type { ForceLogoutUserUseCase } from '../../application/useCases/forceLogoutUser'
import type { GetAdminUserDetailUseCase } from '../../application/useCases/getAdminUserDetail'
import type { ListAdminUsersUseCase } from '../../application/useCases/listAdminUsers'
import type { ReactivateUserUseCase } from '../../application/useCases/reactivateUser'
import type { SuspendUserUseCase } from '../../application/useCases/suspendUser'
import { deleteUserBodySchema, listAdminUsersQuerySchema, suspendUserBodySchema } from './schemas'

export interface AdminUsersRouterDeps {
  listAdminUsers: ListAdminUsersUseCase
  getAdminUserDetail: GetAdminUserDetailUseCase
  suspendUser: SuspendUserUseCase
  reactivateUser: ReactivateUserUseCase
  forceLogoutUser: ForceLogoutUserUseCase
  deleteUserAccount: DeleteUserAccountUseCase
  authMiddleware: AuthMiddleware
}

function serializeSummary(user: AdminUserSummary) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    onboarding_completed: user.onboardingCompleted,
    providers: user.providers,
    created_at: user.createdAt.toISOString(),
  }
}

function serializeDetail(detail: AdminUserDetail) {
  const { account, progression } = detail
  return {
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      username: account.username,
      role: account.role,
      status: account.status,
      suspended_reason: account.suspendedReason,
      suspended_at: account.suspendedAt?.toISOString() ?? null,
      onboarding_completed: account.onboardingCompleted,
      providers: account.providers,
      created_at: account.createdAt.toISOString(),
    },
    progression: {
      xp: progression.xp,
      level: progression.level,
      current_streak: progression.currentStreak,
      longest_streak: progression.longestStreak,
      last_qualifying_activity_date: progression.lastQualifyingActivityDate,
    },
    achievements_count: detail.achievementsCount,
    friends_count: detail.friendsCount,
    portfolio: detail.portfolio,
    open_orders: detail.openOrders,
    timeline: detail.timeline.map((entry) => ({
      id: entry.id,
      admin_id: entry.adminId,
      admin_username: entry.adminUsername ?? null,
      action: entry.action,
      payload: entry.payload,
      result: entry.result,
      error_message: entry.errorMessage ?? null,
      occurred_at: entry.occurredAt.toISOString(),
    })),
  }
}

// Gestão de usuários (Fase N, tarefa N.16). O administrador vê o patrimônio
// absoluto (exceção deliberada à RNF09, CLAUDE.md, sem auditar a leitura), mas
// não edita perfil de terceiro nem muda `role`. Ações que mudam estado exigem
// senha recente (N.22) e passam pela auditoria (N.4).
export function createAdminUsersRouter(deps: AdminUsersRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  const recentAuth = deps.authMiddleware.requireRecentAuth()
  router.param('id', requireUuidParam)

  function sendUserError(err: unknown, res: Response): void {
    if (err instanceof AdminUserNotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof UserStatusConflictError) {
      res.status(409).json({ error: err.message })
      return
    }
    if (err instanceof AdminAccountProtectedError) {
      res.status(422).json({ error: err.message, code: 'admin_account_protected' })
      return
    }
    if (err instanceof DeleteConfirmationMismatchError) {
      res.status(422).json({ error: err.message, code: 'confirmation_mismatch' })
      return
    }
    throw err
  }

  router.get('/admin/users', ...adminOnly, async (req, res) => {
    const parsed = listAdminUsersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: 'filtros de usuários inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    const { q, role, status, provider, created_from, created_to, limit, offset } = parsed.data
    const result = await deps.listAdminUsers.execute({
      q,
      role,
      status,
      provider,
      createdFrom: created_from ? new Date(created_from) : undefined,
      createdTo: created_to ? new Date(created_to) : undefined,
      limit,
      offset,
    })
    res.status(200).json({ users: result.users.map(serializeSummary), total: result.total })
  })

  router.get('/admin/users/:id', ...adminOnly, async (req, res) => {
    try {
      res
        .status(200)
        .json(serializeDetail(await deps.getAdminUserDetail.execute(String(req.params.id))))
    } catch (err) {
      sendUserError(err, res)
    }
  })

  router.post('/admin/users/:id/suspend', ...adminOnly, recentAuth, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = suspendUserBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'informe o motivo da suspensão (3 a 500 caracteres)',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      await deps.suspendUser.execute(req.auth.userId, String(req.params.id), parsed.data.reason)
      res.status(204).end()
    } catch (err) {
      sendUserError(err, res)
    }
  })

  router.post('/admin/users/:id/reactivate', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      await deps.reactivateUser.execute(req.auth.userId, String(req.params.id))
      res.status(204).end()
    } catch (err) {
      sendUserError(err, res)
    }
  })

  router.post('/admin/users/:id/force-logout', ...adminOnly, recentAuth, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      await deps.forceLogoutUser.execute(req.auth.userId, String(req.params.id))
      res.status(204).end()
    } catch (err) {
      sendUserError(err, res)
    }
  })

  router.delete('/admin/users/:id', ...adminOnly, recentAuth, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = deleteUserBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'informe o username da conta para confirmar a exclusão',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      await deps.deleteUserAccount.execute(
        req.auth.userId,
        String(req.params.id),
        parsed.data.confirm_username,
      )
      res.status(204).end()
    } catch (err) {
      sendUserError(err, res)
    }
  })

  return router
}
