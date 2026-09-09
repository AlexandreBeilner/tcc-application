import type {
  CompletionAttemptResult,
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
        microDecisionSelectedOption:
          input.microDecisionSelectedOption !== undefined
            ? input.microDecisionSelectedOption
            : (existing?.microDecisionSelectedOption ?? null),
      }
      if (!progressByUser.has(userId)) {
        progressByUser.set(userId, new Map())
      }
      progressByUser.get(userId)?.set(lessonId, record)
      return record
    },

    async completeIfNotAlreadyCompleted(
      userId: string,
      lessonId: string,
      currentStep: number,
      completedAt: Date,
      microDecisionSelectedOption?: number,
    ): Promise<CompletionAttemptResult> {
      if (!progressByUser.has(userId)) {
        progressByUser.set(userId, new Map())
      }
      const userProgress = progressByUser.get(userId)
      const existing = userProgress?.get(lessonId)
      if (existing?.completedAt != null) {
        return { record: existing, wonRace: false }
      }
      const record: LessonProgressRecord = {
        lessonId,
        currentStep,
        completedAt,
        lastReviewedAt: existing?.lastReviewedAt ?? null,
        microDecisionSelectedOption:
          microDecisionSelectedOption !== undefined
            ? microDecisionSelectedOption
            : (existing?.microDecisionSelectedOption ?? null),
      }
      userProgress?.set(lessonId, record)
      return { record, wonRace: true }
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
