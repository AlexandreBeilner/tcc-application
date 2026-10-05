import { buildLessonView, buildProgression, type LessonView } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface GetTrackMapInput {
  userId: string
}

export class GetTrackMapUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: GetTrackMapInput): Promise<LessonView[]> {
    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])

    const progression = buildProgression(lessons, progress)
    const progressByLessonId = new Map(progress.map((p) => [p.lessonId, p]))

    return lessons.map((lesson) =>
      buildLessonView(lesson, progressByLessonId.get(lesson.id), progression),
    )
  }
}
