import { utcDateString } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface HasCompletedLessonTodayInput {
  userId: string
}

// Consumida em processo pelo módulo `missions` (5.4) — a missão "complete
// uma lição da trilha" é a única com verificação cruzada real contra
// `user_lesson_progress`.
export class HasCompletedLessonTodayUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: HasCompletedLessonTodayInput): Promise<boolean> {
    const today = utcDateString(new Date())
    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    return progress.some((p) => p.completedAt !== null && utcDateString(p.completedAt) === today)
  }
}
