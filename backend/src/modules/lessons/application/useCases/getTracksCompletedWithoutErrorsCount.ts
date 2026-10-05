import { tracksCompletedWithoutErrors } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface GetTracksCompletedWithoutErrorsCountInput {
  userId: string
}

// Consumida em processo pelo módulo `achievements` (backlog engajamento
// H.1) — critério `track_completed_no_errors`. Mesmo formato de junção
// lição+progresso de `GetCompletedTracksUseCase` (F.2), com os 2 campos de
// aposta a mais que a regra de "sem erro" precisa.
export class GetTracksCompletedWithoutErrorsCountUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: GetTracksCompletedWithoutErrorsCountInput): Promise<number> {
    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])

    const progressByLessonId = new Map(progress.map((p) => [p.lessonId, p]))

    const tracks = tracksCompletedWithoutErrors(
      lessons.map((lesson) => {
        const own = progressByLessonId.get(lesson.id)
        return {
          trackNumber: lesson.trackNumber,
          completedAt: own?.completedAt ?? null,
          waivedAt: own?.waivedAt ?? null,
          microDecisionCorrectOption: lesson.microDecisionCorrectOption,
          microDecisionSelectedOption: own?.microDecisionSelectedOption ?? null,
        }
      }),
    )

    return tracks.length
  }
}
