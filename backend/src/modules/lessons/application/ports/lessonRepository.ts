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

export interface CompletionAttemptResult {
  record: LessonProgressRecord
  // `false` quando a linha já tinha `completedAt` setado por outra
  // requisição concorrente que venceu a corrida — quem chama não deve
  // creditar xp/streak/trilha de novo nesse caso (RC ver `advanceLesson.ts`).
  wonRace: boolean
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
  // Transição atômica de "não concluída" pra "concluída" — só marca
  // `completedAt` (e devolve `wonRace: true`) se a linha ainda não tinha
  // `completedAt` setado; duas requisições concorrentes completando a mesma
  // lição só deixam uma vencer (mesmo padrão do `setWhere` em
  // `drizzleMissionRepository.markCompleted`, que existe pelo mesmo motivo:
  // evitar xp em dobro).
  completeIfNotAlreadyCompleted(
    userId: string,
    lessonId: string,
    currentStep: number,
    completedAt: Date,
  ): Promise<CompletionAttemptResult>
  // Só grava `lastReviewedAt` — não mexe em `currentStep`/`completedAt`
  // (aqueles continuam sendo responsabilidade de `upsertProgress`). Requer
  // que a linha já exista (`ReviewLessonUseCase` garante isso checando
  // `completedAt !== null` antes de chamar).
  markReviewed(userId: string, lessonId: string, reviewedAt: Date): Promise<void>
}
