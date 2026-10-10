import type {
  CatalogRow,
  CreatedLesson,
  LessonCatalogRepository,
  LessonRevision,
  PublishChangeResult,
  RevisionAction,
} from '../../application/ports/lessonCatalogRepository'
import type { CatalogLesson, LessonFunnelCounts } from '../../domain/lessonCatalog'
import { contentOf, type LessonContent } from '../../domain/lessonContent'

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

export interface FakeLessonCatalogRepository extends LessonCatalogRepository {
  lessons: CatalogLesson[]
  revisions: (LessonRevision & { lessonId: string })[]
  // Quantos usuários a "publicação" ou a "criação" dizem ter dispensado (a regra de verdade é do
  // adapter com Postgres, coberta no teste de integração).
  waivedUsers: number
}

export function createFakeLessonCatalogRepository(
  seed: CatalogLesson[] = [],
  funnels: Record<string, LessonFunnelCounts> = {},
): FakeLessonCatalogRepository {
  let nextId = 1
  // Ids em formato de UUID: as rotas validam o parâmetro antes de chamar o caso de uso.
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const clock = () => new Date(2026, 9, 5, 12, 0, nextId++)

  const fake: FakeLessonCatalogRepository = {
    lessons: [...seed],
    revisions: [],
    waivedUsers: 0,

    async listWithFunnel(): Promise<CatalogRow[]> {
      return [...fake.lessons]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((lesson) => ({ lesson, funnel: funnels[lesson.id] ?? emptyFunnel() }))
    },

    async findById(id) {
      return fake.lessons.find((lesson) => lesson.id === id)
    },

    async setPublished(id, published): Promise<PublishChangeResult | undefined> {
      const lesson = fake.lessons.find((l) => l.id === id)
      if (!lesson) return undefined
      lesson.published = published
      return { lesson, waivedUsers: published ? fake.waivedUsers : 0 }
    },

    async updateContent(id, content, actorId, action) {
      const lesson = fake.lessons.find((l) => l.id === id)
      if (!lesson) return undefined
      if (!fake.revisions.some((r) => r.lessonId === id)) {
        fake.revisions.push(revision(id, null, 'baseline', contentOf(lesson)))
      }
      Object.assign(lesson, content)
      fake.revisions.push(revision(id, actorId, action, content))
      return lesson
    },

    async create(input, actorId): Promise<CreatedLesson | undefined> {
      const sorted = [...fake.lessons].sort((a, b) => a.sortOrder - b.sortOrder)
      const anchor = input.afterLessonId
        ? fake.lessons.find((l) => l.id === input.afterLessonId)
        : sorted[0]
      if (!anchor) return undefined
      const sortOrder = input.afterLessonId ? anchor.sortOrder + 1 : anchor.sortOrder
      for (const lesson of fake.lessons) {
        if (lesson.sortOrder >= sortOrder) lesson.sortOrder += 1
      }
      const id = uuid(nextId++)
      const lesson: CatalogLesson = {
        id,
        code: `${anchor.trackNumber}.${fake.lessons.length + 1}`,
        trackNumber: anchor.trackNumber,
        trackName: anchor.trackName,
        sortOrder,
        published: true,
        ...input.content,
      }
      fake.lessons.push(lesson)
      fake.revisions.push(revision(id, actorId, 'create', input.content))
      return { lesson, waivedUsers: fake.waivedUsers }
    },

    async listRevisions(lessonId) {
      return fake.revisions
        .filter((r) => r.lessonId === lessonId)
        .map((r) => ({
          id: r.id,
          action: r.action,
          adminId: r.adminId,
          adminUsername: r.adminUsername,
          createdAt: r.createdAt,
        }))
        .reverse()
    },

    async findRevision(lessonId, revisionId) {
      return fake.revisions.find((r) => r.lessonId === lessonId && r.id === revisionId)
    },
  }

  function revision(
    lessonId: string,
    adminId: string | null,
    action: RevisionAction,
    content: LessonContent,
  ): LessonRevision & { lessonId: string } {
    return {
      id: uuid(nextId++),
      lessonId,
      action,
      adminId,
      adminUsername: adminId === null ? null : 'admin',
      createdAt: clock(),
      content: { ...content },
    }
  }

  return fake
}
