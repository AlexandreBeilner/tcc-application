import type {
  CatalogRow,
  LessonCatalogRepository,
  PublishChangeResult,
} from '../../application/ports/lessonCatalogRepository'
import type { CatalogLesson, LessonFunnelCounts } from '../../domain/lessonCatalog'

export function emptyFunnel(overrides: Partial<LessonFunnelCounts> = {}): LessonFunnelCounts {
  return {
    started: 0,
    completed: 0,
    avgSecondsToComplete: null,
    medianSecondsToComplete: null,
    betAnswered: 0,
    betCorrect: 0,
    abandonedByStep: [0, 0, 0, 0],
    ...overrides,
  }
}

export function createFakeLessonCatalogRepository(
  seed: CatalogLesson[] = [],
  funnels: Record<string, LessonFunnelCounts> = {},
): LessonCatalogRepository & { lessons: CatalogLesson[]; waivedOnPublish: number } {
  const state = { lessons: [...seed], waivedOnPublish: 0 }

  return {
    // Só de teste: quantos usuários a "publicação" diz ter dispensado (a regra de verdade é do
    // adapter com Postgres, coberta no teste de integração).
    get lessons() {
      return state.lessons
    },
    get waivedOnPublish() {
      return state.waivedOnPublish
    },
    set waivedOnPublish(value: number) {
      state.waivedOnPublish = value
    },

    async listWithFunnel(): Promise<CatalogRow[]> {
      return [...state.lessons]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((lesson) => ({ lesson, funnel: funnels[lesson.id] ?? emptyFunnel() }))
    },

    async findById(id) {
      return state.lessons.find((lesson) => lesson.id === id)
    },

    async setPublished(id, published): Promise<PublishChangeResult | undefined> {
      const lesson = state.lessons.find((l) => l.id === id)
      if (!lesson) return undefined
      lesson.published = published
      return { lesson, waivedUsers: published ? state.waivedOnPublish : 0 }
    },
  }
}
