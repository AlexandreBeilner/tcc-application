import type { GetLessonCardFunnelUseCase } from '../../../lessons/application/useCases/getLessonCardFunnel'
import type {
  ListLessonCatalogUseCase,
  SetLessonPublishedUseCase,
} from '../../../lessons/application/useCases/manageLessonCatalog'
import type {
  CreateLessonUseCase,
  GetLessonForEditUseCase,
  GetLessonRevisionUseCase,
  RestoreLessonRevisionUseCase,
  UpdateLessonContentUseCase,
} from '../../../lessons/application/useCases/manageLessonContent'
import {
  InvalidLessonContentError,
  LessonNotFoundError,
  LessonPublicationConflictError,
  LessonRevisionNotFoundError,
  LessonUnchangedError,
} from '../../../lessons/domain/errors'
import type { CatalogLesson } from '../../../lessons/domain/lessonCatalog'
import { contentOf } from '../../../lessons/domain/lessonContent'
import {
  AdminLessonConflictError,
  AdminLessonNotFoundError,
  InvalidAdminLessonError,
} from '../../domain/errors'
import type {
  LessonCatalogAdmin,
  LessonDetailView,
} from '../../application/ports/lessonCatalogAdmin'

export interface InProcessLessonCatalogAdminDeps {
  listLessonCatalog: ListLessonCatalogUseCase
  getLessonCardFunnel: GetLessonCardFunnelUseCase
  setLessonPublished: SetLessonPublishedUseCase
  getLessonForEdit: GetLessonForEditUseCase
  updateLessonContent: UpdateLessonContentUseCase
  createLesson: CreateLessonUseCase
  getLessonRevision: GetLessonRevisionUseCase
  restoreLessonRevision: RestoreLessonRevisionUseCase
}

function toDetail(lesson: CatalogLesson): LessonDetailView {
  return {
    id: lesson.id,
    code: lesson.code,
    trackNumber: lesson.trackNumber,
    trackName: lesson.trackName,
    sortOrder: lesson.sortOrder,
    published: lesson.published,
    content: contentOf(lesson),
  }
}

// Traduz as recusas do módulo dono (lições) pros erros do painel, pra o router mapear 404/409/422
// sem conhecer esse módulo.
function translate(err: unknown): never {
  if (err instanceof LessonNotFoundError || err instanceof LessonRevisionNotFoundError) {
    throw new AdminLessonNotFoundError(err.message)
  }
  if (err instanceof LessonPublicationConflictError || err instanceof LessonUnchangedError) {
    throw new AdminLessonConflictError(err.message)
  }
  if (err instanceof InvalidLessonContentError) {
    throw new InvalidAdminLessonError(err.message)
  }
  throw err
}

export function createInProcessLessonCatalogAdmin(
  deps: InProcessLessonCatalogAdminDeps,
): LessonCatalogAdmin {
  return {
    async list() {
      const entries = await deps.listLessonCatalog.execute()
      return entries.map(({ lesson, prerequisiteCode, funnel }) => ({
        id: lesson.id,
        code: lesson.code,
        title: lesson.title,
        trackNumber: lesson.trackNumber,
        trackName: lesson.trackName,
        sortOrder: lesson.sortOrder,
        microDecisionType: lesson.microDecisionType,
        hasBet: lesson.microDecisionOptions !== null && lesson.microDecisionCorrectOption !== null,
        unlocksKeys: lesson.unlocksKeys,
        published: lesson.published,
        prerequisiteCode,
        funnel: {
          started: funnel.started,
          completed: funnel.completed,
          abandoned: funnel.abandoned,
          completionRate: funnel.completionRate,
          avgSecondsToComplete: funnel.avgSecondsToComplete,
          medianSecondsToComplete: funnel.medianSecondsToComplete,
          betAnswered: funnel.betAnswered,
          betCorrect: funnel.betCorrect,
          betAccuracy: funnel.betAccuracy,
          abandonedByStep: funnel.abandonedByStep,
        },
      }))
    },

    async cardFunnel(lessonId, days) {
      try {
        return await deps.getLessonCardFunnel.execute(lessonId, days)
      } catch (err) {
        translate(err)
      }
    },

    async setPublished(lessonId, published) {
      try {
        const { lesson, waivedUsers } = await deps.setLessonPublished.execute(lessonId, published)
        return {
          id: lesson.id,
          code: lesson.code,
          title: lesson.title,
          published: lesson.published,
          waivedUsers,
        }
      } catch (err) {
        translate(err)
      }
    },

    async get(lessonId) {
      try {
        const { lesson, revisions } = await deps.getLessonForEdit.execute(lessonId)
        return { lesson: toDetail(lesson), revisions }
      } catch (err) {
        translate(err)
      }
    },

    async update(adminId, lessonId, content) {
      try {
        const result = await deps.updateLessonContent.execute(adminId, lessonId, content)
        return {
          lesson: toDetail(result.lesson),
          warnings: result.warnings,
          changedFields: result.changedFields,
        }
      } catch (err) {
        translate(err)
      }
    },

    async create(adminId, input) {
      try {
        const result = await deps.createLesson.execute(adminId, input)
        return {
          lesson: toDetail(result.lesson),
          warnings: result.warnings,
          waivedUsers: result.waivedUsers,
        }
      } catch (err) {
        translate(err)
      }
    },

    async getRevision(lessonId, revisionId) {
      try {
        const { content, ...revision } = await deps.getLessonRevision.execute(lessonId, revisionId)
        return { ...revision, content }
      } catch (err) {
        translate(err)
      }
    },

    async restore(adminId, lessonId, revisionId) {
      try {
        const result = await deps.restoreLessonRevision.execute(adminId, lessonId, revisionId)
        return {
          lesson: toDetail(result.lesson),
          warnings: result.warnings,
          changedFields: result.changedFields,
        }
      } catch (err) {
        translate(err)
      }
    },
  }
}
