import { LessonLockedError, LessonNotFoundError } from '../../domain/errors'
import { buildLessonView, buildProgression, type LessonView } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface GetLessonInput {
  userId: string
  lessonId: string
}

export class GetLessonUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: GetLessonInput): Promise<LessonView> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])
    const own = progress.find((p) => p.lessonId === input.lessonId)
    const view = buildLessonView(lesson, own, buildProgression(lessons, progress))

    // Lição bloqueada nunca é exposta em detalhe (tela 3.2) — mesmo status
    // 404 de "não encontrada", pra não distinguir "não existe" de
    // "existe mas você não pode ver" (spec 5.1/5.2).
    if (view.status === 'locked') {
      throw new LessonLockedError('lição bloqueada')
    }

    return view
  }
}
