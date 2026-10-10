import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import type { ZodType } from 'zod'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  AdminCorrectionConflictError,
  AdminCorrectionNotFoundError,
  AdminUserNotFoundError,
  CashCreditOverflowError,
  CashCreditRejectedError,
  InvalidAdminCorrectionError,
} from '../../domain/errors'
import type { CorrectedProgression } from '../../application/ports/userCorrections'
import type { CreditUserCashUseCase } from '../../application/useCases/creditUserCash'
import type {
  AdjustUserXpUseCase,
  CompleteUserLessonUseCase,
  GetUserCorrectionContextUseCase,
  GrantUserAchievementUseCase,
  ReopenUserLessonUseCase,
  SetUserStreakUseCase,
} from '../../application/useCases/userCorrections'
import {
  adjustXpBodySchema,
  correctionReasonBodySchema,
  creditUserBodySchema,
  setStreakBodySchema,
} from './schemas'

export interface AdminUserCorrectionsRouterDeps {
  creditUserCash: CreditUserCashUseCase
  adjustUserXp: AdjustUserXpUseCase
  setUserStreak: SetUserStreakUseCase
  grantUserAchievement: GrantUserAchievementUseCase
  completeUserLesson: CompleteUserLessonUseCase
  reopenUserLesson: ReopenUserLessonUseCase
  getCorrectionContext: GetUserCorrectionContextUseCase
  authMiddleware: AuthMiddleware
}

function serializeProgression(progression: CorrectedProgression) {
  return {
    xp: progression.xp,
    level: progression.level,
    current_streak: progression.currentStreak,
    longest_streak: progression.longestStreak,
  }
}

// Correções manuais de conta (Fase N, tarefa N.17): crédito de caixa, XP, streak,
// conquistas e lições. Todas exigem papel admin e senha recente (N.22), passam pela
// auditoria (N.4) e pelos casos de uso dos módulos donos do dado. Resetar carteira
// fica fora (apagaria histórico imutável).
export function createAdminUserCorrectionsRouter(deps: AdminUserCorrectionsRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  const recentAuth = deps.authMiddleware.requireRecentAuth()
  router.param('id', requireUuidParam)
  router.param('achievementId', requireUuidParam)
  router.param('lessonId', requireUuidParam)

  function sendError(err: unknown, res: Response): void {
    if (err instanceof AdminUserNotFoundError || err instanceof AdminCorrectionNotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof AdminCorrectionConflictError) {
      res.status(409).json({ error: err.message })
      return
    }
    if (err instanceof InvalidAdminCorrectionError) {
      res.status(422).json({ error: err.message, code: 'invalid_correction' })
      return
    }
    if (err instanceof CashCreditRejectedError) {
      res.status(422).json({ error: err.message, code: 'credit_rejected' })
      return
    }
    if (err instanceof CashCreditOverflowError) {
      res.status(422).json({ error: err.message, code: 'balance_overflow' })
      return
    }
    throw err
  }

  // Valida o corpo e entrega o admin autenticado ao handler; qualquer erro de domínio
  // vira a resposta HTTP certa.
  function mutation<T>(
    schema: ZodType<T>,
    invalidMessage: string,
    handle: (adminId: string, req: Request, body: T, res: Response) => Promise<void>,
  ): RequestHandler[] {
    return [
      ...adminOnly,
      recentAuth,
      async (req, res) => {
        if (!req.auth) {
          res.status(401).json({ error: 'token ausente' })
          return
        }
        const parsed = schema.safeParse(req.body ?? {})
        if (!parsed.success) {
          res.status(400).json({ error: invalidMessage, details: z.flattenError(parsed.error) })
          return
        }
        try {
          await handle(req.auth.userId, req, parsed.data, res)
        } catch (err) {
          sendError(err, res)
        }
      },
    ]
  }

  router.get('/admin/users/:id/corrections', ...adminOnly, async (req, res) => {
    try {
      const context = await deps.getCorrectionContext.execute(String(req.params.id))
      res.status(200).json({
        achievements: context.achievements,
        lessons: context.lessons.map((lesson) => ({
          id: lesson.id,
          code: lesson.code,
          title: lesson.title,
          track_number: lesson.trackNumber,
          status: lesson.status,
        })),
      })
    } catch (err) {
      sendError(err, res)
    }
  })

  router.post(
    '/admin/users/:id/credit',
    ...mutation(
      creditUserBodySchema,
      'informe um valor positivo (e, se quiser, o motivo)',
      async (adminId, req, body, res) => {
        const result = await deps.creditUserCash.execute(adminId, String(req.params.id), {
          amount: body.amount,
          reason: body.reason || undefined,
        })
        res.status(200).json({ user_id: String(req.params.id), credited: result.credited })
      },
    ),
  )

  router.post(
    '/admin/users/:id/xp',
    ...mutation(
      adjustXpBodySchema,
      'informe o ajuste de XP (inteiro diferente de zero) e o motivo (3 a 500 caracteres)',
      async (adminId, req, body, res) => {
        const result = await deps.adjustUserXp.execute(adminId, String(req.params.id), body)
        res.status(200).json(serializeProgression(result))
      },
    ),
  )

  router.post(
    '/admin/users/:id/streak',
    ...mutation(
      setStreakBodySchema,
      'informe o streak (inteiro de 0 a 36500) e o motivo (3 a 500 caracteres)',
      async (adminId, req, body, res) => {
        const result = await deps.setUserStreak.execute(adminId, String(req.params.id), body)
        res.status(200).json(serializeProgression(result))
      },
    ),
  )

  const reasonMessage = 'informe o motivo (3 a 500 caracteres)'

  router.post(
    '/admin/users/:id/achievements/:achievementId/grant',
    ...mutation(correctionReasonBodySchema, reasonMessage, async (adminId, req, body, res) => {
      await deps.grantUserAchievement.execute(
        adminId,
        String(req.params.id),
        String(req.params.achievementId),
        body.reason,
      )
      res.status(204).end()
    }),
  )

  router.post(
    '/admin/users/:id/lessons/:lessonId/complete',
    ...mutation(correctionReasonBodySchema, reasonMessage, async (adminId, req, body, res) => {
      await deps.completeUserLesson.execute(
        adminId,
        String(req.params.id),
        String(req.params.lessonId),
        body.reason,
      )
      res.status(204).end()
    }),
  )

  router.post(
    '/admin/users/:id/lessons/:lessonId/reopen',
    ...mutation(correctionReasonBodySchema, reasonMessage, async (adminId, req, body, res) => {
      await deps.reopenUserLesson.execute(
        adminId,
        String(req.params.id),
        String(req.params.lessonId),
        body.reason,
      )
      res.status(204).end()
    }),
  )

  return router
}
