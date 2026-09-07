import type {
  LessonProgressRecord,
  LessonRepository,
  UpsertProgressInput,
} from '../../application/ports/lessonRepository'
import type { LessonSummary } from '../../domain/lesson'

export function createFakeLessonRepository(seedLessons: LessonSummary[] = []): LessonRepository {
  const lessons = [...seedLessons]
  const progressByUser = new Map<string, Map<string, LessonProgressRecord>>()

  return {
    async listAll() {
      return [...lessons].sort((a, b) => a.sortOrder - b.sortOrder)
    },

    async findById(id) {
      return lessons.find((lesson) => lesson.id === id)
    },

    async listProgressForUser(userId) {
      return [...(progressByUser.get(userId)?.values() ?? [])]
    },

    async upsertProgress(userId: string, lessonId: string, input: UpsertProgressInput) {
      const existing = progressByUser.get(userId)?.get(lessonId)
      const record: LessonProgressRecord = {
        lessonId,
        currentStep: input.currentStep,
        completedAt: input.completedAt,
        lastReviewedAt: existing?.lastReviewedAt ?? null,
      }
      if (!progressByUser.has(userId)) {
        progressByUser.set(userId, new Map())
      }
      progressByUser.get(userId)?.set(lessonId, record)
      return record
    },

    async markReviewed(userId: string, lessonId: string, reviewedAt: Date) {
      const existing = progressByUser.get(userId)?.get(lessonId)
      if (!existing) {
        return
      }
      progressByUser.get(userId)?.set(lessonId, { ...existing, lastReviewedAt: reviewedAt })
    },
  }
}
