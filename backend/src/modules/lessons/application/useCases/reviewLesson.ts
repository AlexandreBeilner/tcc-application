import { LessonNotCompletedError, LessonNotFoundError } from '../../domain/errors'
import type { LessonRepository } from '../ports/lessonRepository'

export interface ReviewLessonInput {
  userId: string
  lessonId: string
}

// Revisão voluntária de lição já concluída (backlog engajamento H.2, tela
// 3.2 "modo revisão") — reabrir uma lição concluída já é permitido sem
// gate nenhum (`AdvanceLessonUseCase`/`GetLessonUseCase`); este caso de uso
// só registra `lastReviewedAt` pra sustentar a missão "revise uma lição
// antiga" com verificação cruzada de verdade, em vez de autorreporte do
// cliente. Nunca credita xp/streak — só a missão em si credita, quando o
// usuário confirma a conclusão dela.
export class ReviewLessonUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: ReviewLessonInput): Promise<void> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    const own = progress.find((p) => p.lessonId === input.lessonId)
    if (!own || own.completedAt === null) {
      throw new LessonNotCompletedError('lição ainda não concluída — não há o que revisar')
    }

    await this.lessonRepository.markReviewed(input.userId, input.lessonId, new Date())
  }
}
