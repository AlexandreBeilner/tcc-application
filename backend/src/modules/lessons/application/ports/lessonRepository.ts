import type { LessonProgressSnapshot, LessonSummary } from '../../domain/lesson'

export interface LessonProgressRecord extends LessonProgressSnapshot {
  lessonId: string
  // Revisão voluntária de lição já concluída (H.2) — `null` até a primeira
  // vez que o usuário reabre e re-percorre a lição depois de concluída.
  lastReviewedAt: Date | null
}

export interface UpsertProgressInput {
  currentStep: number
  completedAt: Date | null
}

export interface LessonRepository {
  listAll(): Promise<LessonSummary[]>
  findById(id: string): Promise<LessonSummary | undefined>
  listProgressForUser(userId: string): Promise<LessonProgressRecord[]>
  upsertProgress(
    userId: string,
    lessonId: string,
    input: UpsertProgressInput,
  ): Promise<LessonProgressRecord>
  // Só grava `lastReviewedAt` — não mexe em `currentStep`/`completedAt`
  // (aqueles continuam sendo responsabilidade de `upsertProgress`). Requer
  // que a linha já exista (`ReviewLessonUseCase` garante isso checando
  // `completedAt !== null` antes de chamar).
  markReviewed(userId: string, lessonId: string, reviewedAt: Date): Promise<void>
}
