import type {
  ListLessonCatalogUseCase,
  SetLessonPublishedUseCase,
} from '../../../lessons/application/useCases/manageLessonCatalog'
import { LessonNotFoundError, LessonPublicationConflictError } from '../../../lessons/domain/errors'
import { AdminLessonConflictError, AdminLessonNotFoundError } from '../../domain/errors'
import type { LessonCatalogAdmin } from '../../application/ports/lessonCatalogAdmin'

export interface InProcessLessonCatalogAdminDeps {
  listLessonCatalog: ListLessonCatalogUseCase
  setLessonPublished: SetLessonPublishedUseCase
}

// Traduz as recusas do módulo dono (lições) pros erros do painel, pra o router mapear 404/409/422
// sem conhecer esse módulo.
function translate(err: unknown): never {
  if (err instanceof LessonNotFoundError) {
    throw new AdminLessonNotFoundError(err.message)
  }
  if (err instanceof LessonPublicationConflictError) {
    throw new AdminLessonConflictError(err.message)
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
  }
}
