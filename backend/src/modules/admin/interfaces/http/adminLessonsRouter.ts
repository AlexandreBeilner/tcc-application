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
import type {
  LessonCatalogItem,
  LessonContentView,
  LessonDetailView,
  LessonRevisionItem,
} from '../../application/ports/lessonCatalogAdmin'
import type {
  CreateLessonAdminUseCase,
  GetLessonForEditAdminUseCase,
  GetLessonRevisionAdminUseCase,
  ListLessonCatalogAdminUseCase,
  RestoreLessonRevisionAdminUseCase,
  SetLessonPublishedAdminUseCase,
  UpdateLessonContentAdminUseCase,
} from '../../application/useCases/lessonCatalog'
import {
  createLessonBodySchema,
  lessonContentBodySchema,
  setLessonPublishedBodySchema,
} from './schemas'

export interface AdminLessonsRouterDeps {
  listLessonCatalog: ListLessonCatalogAdminUseCase
  setLessonPublished: SetLessonPublishedAdminUseCase
  getLessonForEdit: GetLessonForEditAdminUseCase
  updateLessonContent: UpdateLessonContentAdminUseCase
  createLesson: CreateLessonAdminUseCase
  getLessonRevision: GetLessonRevisionAdminUseCase
  restoreLessonRevision: RestoreLessonRevisionAdminUseCase
  authMiddleware: AuthMiddleware
}

function serializeContent(content: LessonContentView) {
  return {
    title: content.title,
    central_concept: content.centralConcept,
    scenario_text: content.scenarioText,
    micro_decision_prompt: content.microDecisionPrompt,
    micro_decision_type: content.microDecisionType,
    micro_decision_asset_ticker: content.microDecisionAssetTicker,
    micro_decision_options: content.microDecisionOptions,
    micro_decision_correct_option: content.microDecisionCorrectOption,
    revelation_text: content.revelationText,
    unlocks_description: content.unlocksDescription,
    unlocks_keys: content.unlocksKeys,
    unlocks_asset_ticker: content.unlocksAssetTicker,
  }
}

function serializeDetail(lesson: LessonDetailView) {
  return {
    id: lesson.id,
    code: lesson.code,
    track_number: lesson.trackNumber,
    track_name: lesson.trackName,
    sort_order: lesson.sortOrder,
    published: lesson.published,
    ...serializeContent(lesson.content),
  }
}

function serializeRevision(revision: LessonRevisionItem) {
  return {
    id: revision.id,
    action: revision.action,
    admin_id: revision.adminId,
    admin_username: revision.adminUsername,
    created_at: revision.createdAt.toISOString(),
  }
}

// Corpo da API (snake_case) -> conteúdo do domínio.
function toContent(body: {
  title: string
  central_concept: string
  scenario_text: string
  micro_decision_prompt: string
  micro_decision_type: LessonContentView['microDecisionType']
  micro_decision_asset_ticker: string | null
  micro_decision_options: string[] | null
  micro_decision_correct_option: number | null
  revelation_text: string
  unlocks_description: string | null
  unlocks_keys: string[]
  unlocks_asset_ticker: string | null
}): LessonContentView {
  return {
    title: body.title,
    centralConcept: body.central_concept,
    scenarioText: body.scenario_text,
    microDecisionPrompt: body.micro_decision_prompt,
    microDecisionType: body.micro_decision_type,
    microDecisionAssetTicker: body.micro_decision_asset_ticker,
    microDecisionOptions: body.micro_decision_options,
    microDecisionCorrectOption: body.micro_decision_correct_option,
    revelationText: body.revelation_text,
    unlocksDescription: body.unlocks_description,
    unlocksKeys: body.unlocks_keys,
    unlocksAssetTicker: body.unlocks_asset_ticker,
  }
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

// Conteúdo das lições no painel (Fase N, tarefas N.18 e N.23). Só admin. Publicar, despublicar, editar,
// criar e restaurar são auditados mas não pedem senha recente: não apagam dado de ninguém (o progresso
// fica intacto, cada edição vira uma revisão restaurável) e desfazem-se com o gesto contrário.
export function createAdminLessonsRouter(deps: AdminLessonsRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  router.param('id', requireUuidParam)
  router.param('revisionId', requireUuidParam)

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

  router.get('/admin/lessons/:id', ...adminOnly, async (req, res) => {
    try {
      const { lesson, revisions } = await deps.getLessonForEdit.execute(String(req.params.id))
      res
        .status(200)
        .json({ lesson: serializeDetail(lesson), revisions: revisions.map(serializeRevision) })
    } catch (err) {
      sendLessonError(err, res)
    }
  })

  router.put('/admin/lessons/:id', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = lessonContentBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'conteúdo da lição inválido',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      const result = await deps.updateLessonContent.execute(
        req.auth.userId,
        String(req.params.id),
        toContent(parsed.data),
      )
      res.status(200).json({ lesson: serializeDetail(result.lesson), warnings: result.warnings })
    } catch (err) {
      sendLessonError(err, res)
    }
  })

  router.post('/admin/lessons', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = createLessonBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'conteúdo da lição inválido',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      const result = await deps.createLesson.execute(req.auth.userId, {
        content: toContent(parsed.data),
        afterLessonId: parsed.data.after_lesson_id,
      })
      res.status(201).json({
        lesson: serializeDetail(result.lesson),
        warnings: result.warnings,
        waived_users: result.waivedUsers,
      })
    } catch (err) {
      sendLessonError(err, res)
    }
  })

  router.get('/admin/lessons/:id/revisions/:revisionId', ...adminOnly, async (req, res) => {
    try {
      const revision = await deps.getLessonRevision.execute(
        String(req.params.id),
        String(req.params.revisionId),
      )
      res
        .status(200)
        .json({ ...serializeRevision(revision), ...serializeContent(revision.content) })
    } catch (err) {
      sendLessonError(err, res)
    }
  })

  router.post(
    '/admin/lessons/:id/revisions/:revisionId/restore',
    ...adminOnly,
    async (req, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'token ausente' })
        return
      }
      try {
        const result = await deps.restoreLessonRevision.execute(
          req.auth.userId,
          String(req.params.id),
          String(req.params.revisionId),
        )
        res.status(200).json({ lesson: serializeDetail(result.lesson), warnings: result.warnings })
      } catch (err) {
        sendLessonError(err, res)
      }
    },
  )

  return router
}
