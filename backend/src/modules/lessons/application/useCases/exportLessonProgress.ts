import type { LessonRepository } from '../ports/lessonRepository'

export interface ExportLessonProgressInput {
  userId: string
}

export interface ExportedLessonProgressRecord {
  lessonId: string
  currentStep: number
  completedAt: Date | null
  // RC.2.3: respostas dadas à pergunta da lição e se acertou de primeira (LGPD).
  microDecisionAttempts: number
}

// Consumida em processo pelo módulo `auth` (5.11, portabilidade RNF04) —
// reaproveita `listProgressForUser`, mesmo padrão de
// `HasCompletedLessonTodayUseCase`/`CountCompletedLessonsUseCase`.
export class ExportLessonProgressUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: ExportLessonProgressInput): Promise<ExportedLessonProgressRecord[]> {
    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    return progress.map((p) => ({
      lessonId: p.lessonId,
      currentStep: p.currentStep,
      completedAt: p.completedAt,
      microDecisionAttempts: p.microDecisionAttempts,
    }))
  }
}
