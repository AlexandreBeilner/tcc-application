import type { LessonProgressSnapshot, LessonSummary } from '../../domain/lesson'

export interface LessonProgressRecord extends LessonProgressSnapshot {
  lessonId: string
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
}
