import type {
  CompletionAttemptResult,
  LessonProgressRecord,
  LessonRepository,
  UpsertProgressInput,
} from '../../application/ports/lessonRepository'
import type { CheckpointRecord, LessonSummary } from '../../domain/lesson'

export function createFakeLessonRepository(
  seedLessons: LessonSummary[] = [],
  clock: () => Date = () => new Date(),
): LessonRepository & { waive(userId: string, lessonId: string, waivedAt?: Date): void } {
  const lessons = [...seedLessons]
  const progressByUser = new Map<string, Map<string, LessonProgressRecord>>()
  const checkpoints = new Map<string, CheckpointRecord>()
  const checkpointKey = (userId: string, lessonId: string, checkpointId: string) =>
    `${userId}|${lessonId}|${checkpointId}`

  return {
    // Só de teste (não faz parte da porta): planta uma dispensa (N.24) sem
    // simular a criação de lição, que é da N.23.
    waive(userId: string, lessonId: string, waivedAt: Date = clock()) {
      if (!progressByUser.has(userId)) {
        progressByUser.set(userId, new Map())
      }
      const existing = progressByUser.get(userId)?.get(lessonId)
      progressByUser.get(userId)?.set(lessonId, {
        lessonId,
        currentStep: existing?.currentStep ?? 0,
        completedAt: existing?.completedAt ?? null,
        updatedAt: existing?.updatedAt ?? waivedAt,
        lastReviewedAt: existing?.lastReviewedAt ?? null,
        microDecisionSelectedOption: existing?.microDecisionSelectedOption ?? null,
        waivedAt,
      })
    },

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
        updatedAt: clock(),
        lastReviewedAt: existing?.lastReviewedAt ?? null,
        waivedAt: existing?.waivedAt ?? null,
        microDecisionSelectedOption:
          input.microDecisionSelectedOption !== undefined
            ? input.microDecisionSelectedOption
            : (existing?.microDecisionSelectedOption ?? null),
        microDecisionAttempts: existing?.microDecisionAttempts ?? 0,
        microDecisionWrongOptions: existing?.microDecisionWrongOptions ?? [],
        microDecisionSolvedAt: existing?.microDecisionSolvedAt ?? null,
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
        updatedAt: clock(),
        lastReviewedAt: existing?.lastReviewedAt ?? null,
        waivedAt: existing?.waivedAt ?? null,
        microDecisionSelectedOption:
          microDecisionSelectedOption !== undefined
            ? microDecisionSelectedOption
            : (existing?.microDecisionSelectedOption ?? null),
        microDecisionAttempts: existing?.microDecisionAttempts ?? 0,
        microDecisionWrongOptions: existing?.microDecisionWrongOptions ?? [],
        microDecisionSolvedAt: existing?.microDecisionSolvedAt ?? null,
      }
      userProgress?.set(lessonId, record)
      return { record, wonRace: true }
    },

    async recordMicroDecisionAnswer(userId, lessonId, answer) {
      const existing = progressByUser.get(userId)?.get(lessonId)
      if (!existing || existing.microDecisionSolvedAt !== null || existing.completedAt !== null) {
        return undefined
      }
      const record: LessonProgressRecord = {
        ...existing,
        microDecisionSelectedOption: existing.microDecisionSelectedOption ?? answer.selectedOption,
        microDecisionAttempts: existing.microDecisionAttempts + 1,
        microDecisionWrongOptions:
          answer.correct || existing.microDecisionWrongOptions.includes(answer.selectedOption)
            ? existing.microDecisionWrongOptions
            : [...existing.microDecisionWrongOptions, answer.selectedOption],
        microDecisionSolvedAt: answer.correct ? answer.answeredAt : null,
      }
      progressByUser.get(userId)?.set(lessonId, record)
      return record
    },

    async listCheckpointsForUser(userId, lessonId) {
      return [...checkpoints.entries()]
        .filter(([key]) => key.startsWith(`${userId}|${lessonId}|`))
        .map(([, record]) => record)
    },

    async recordCheckpointAnswer(userId, lessonId, checkpointId, answer) {
      const key = checkpointKey(userId, lessonId, checkpointId)
      const existing = checkpoints.get(key)
      if (existing?.solvedAt) {
        return existing
      }
      const wrongOptions = existing?.wrongOptions ?? []
      const record: CheckpointRecord = {
        checkpointId,
        attempts: (existing?.attempts ?? 0) + 1,
        wrongOptions:
          answer.correct || answer.choice === null || wrongOptions.includes(answer.choice)
            ? wrongOptions
            : [...wrongOptions, answer.choice],
        solvedAt: answer.correct ? answer.answeredAt : null,
      }
      checkpoints.set(key, record)
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
