import { countReviewedLessons } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface CountReviewedLessonsInput {
  userId: string
}

// Consumida em processo pelo módulo `achievements` (backlog engajamento
// H.1) — critério `lesson_reviewed`. Mesmo padrão de `CountCompletedLessonsUseCase`
// (5.2): nenhum método novo no repositório, só reaproveita `listProgressForUser`
// (que já carrega `lastReviewedAt` desde a H.2).
export class CountReviewedLessonsUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: CountReviewedLessonsInput): Promise<number> {
    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    return countReviewedLessons(progress)
  }
}
