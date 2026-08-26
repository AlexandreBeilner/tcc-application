import type { LessonRepository } from '../ports/lessonRepository'

export interface CountCompletedLessonsInput {
  userId: string
}

// Consumida em processo pelo módulo `achievements` (5.2) — critério
// `lessons_completed`. Reaproveita `listProgressForUser`, mesmo padrão de
// `HasCompletedLessonTodayUseCase` (5.4): nenhum método novo no repositório.
export class CountCompletedLessonsUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: CountCompletedLessonsInput): Promise<number> {
    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    return progress.filter((p) => p.completedAt !== null).length
  }
}
