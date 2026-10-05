import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  AdminLessonConflictError,
  AdminLessonNotFoundError,
  InvalidAdminLessonError,
} from '../../domain/errors'
import type { LessonCatalogItem } from '../../application/ports/lessonCatalogAdmin'
import type {
  ListLessonCatalogAdminUseCase,
  SetLessonPublishedAdminUseCase,
} from '../../application/useCases/lessonCatalog'
import { setLessonPublishedBodySchema } from './schemas'

export interface AdminLessonsRouterDeps {
  listLessonCatalog: ListLessonCatalogAdminUseCase
  setLessonPublished: SetLessonPublishedAdminUseCase
  authMiddleware: AuthMiddleware
}

function serializeLesson(item: LessonCatalogItem) {
  return {
    id: item.id,
    code: item.code,
    title: item.title,
    track_number: item.trackNumber,
    track_name: item.trackName,
    sort_order: item.sortOrder,
    micro_decision_type: item.microDecisionType,
    has_bet: item.hasBet,
    unlocks_keys: item.unlocksKeys,
    published: item.published,
    prerequisite_code: item.prerequisiteCode,
    funnel: {
      started: item.funnel.started,
      completed: item.funnel.completed,
      abandoned: item.funnel.abandoned,
      completion_rate: item.funnel.completionRate,
      avg_seconds_to_complete: item.funnel.avgSecondsToComplete,
      median_seconds_to_complete: item.funnel.medianSecondsToComplete,
      bet_answered: item.funnel.betAnswered,
      bet_correct: item.funnel.betCorrect,
      bet_accuracy: item.funnel.betAccuracy,
      abandoned_by_step: item.funnel.abandonedByStep,
    },
  }
}

// Conteúdo das lições no painel (Fase N, tarefa N.18). Só admin. Publicar e despublicar são
// auditados mas não pedem senha recente: não apagam dado de ninguém (o progresso fica intacto) e
// desfazem-se com o gesto contrário.
export function createAdminLessonsRouter(deps: AdminLessonsRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  router.param('id', requireUuidParam)

  function sendLessonError(err: unknown, res: Response): void {
    if (err instanceof AdminLessonNotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof AdminLessonConflictError) {
      res.status(409).json({ error: err.message })
      return
    }
    if (err instanceof InvalidAdminLessonError) {
      res.status(422).json({ error: err.message, code: 'invalid_lesson' })
      return
    }
    throw err
  }

  router.get('/admin/lessons', ...adminOnly, async (_req, res) => {
    const lessons = await deps.listLessonCatalog.execute()
    res.status(200).json({ lessons: lessons.map(serializeLesson) })
  })

  router.patch('/admin/lessons/:id/published', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = setLessonPublishedBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'informe published como verdadeiro ou falso',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      const result = await deps.setLessonPublished.execute(
        req.auth.userId,
        String(req.params.id),
        parsed.data.published,
      )
      res.status(200).json({
        id: result.id,
        code: result.code,
        title: result.title,
        published: result.published,
        waived_users: result.waivedUsers,
      })
    } catch (err) {
      sendLessonError(err, res)
    }
  })

  return router
}
