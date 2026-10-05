import { LESSON_UNLOCK_STEP } from '../../domain/lesson'
import {
  LessonAlreadyCompletedError,
  LessonNotFoundError,
  LessonNotReopenableError,
} from '../../domain/errors'
import type { LessonRepository } from '../ports/lessonRepository'

// Marca uma lição como concluída na mão (N.17). Só grava o progresso: não dá XP, não
// toca o streak, não conta pra missão nem vai pro feed social (o XP, se for devido, é
// um ajuste separado e auditado). Pula o gate de passos e de desbloqueio de propósito:
// é correção de suporte.
export class MarkLessonCompletedUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.lessonRepository.findById(lessonId)
    if (!lesson) throw new LessonNotFoundError('lição não encontrada')

    const progress = await this.lessonRepository.listProgressForUser(userId)
    const own = progress.find((p) => p.lessonId === lessonId)
    if (own?.completedAt) throw new LessonAlreadyCompletedError('a lição já está concluída')

    await this.lessonRepository.upsertProgress(userId, lessonId, {
      currentStep: Math.max(own?.currentStep ?? 0, LESSON_UNLOCK_STEP),
      completedAt: this.now(),
    })
  }
}

// Reabre uma lição concluída (N.17): volta pro passo 0 e limpa a conclusão, mantendo a
// escolha da micro-decisão e o XP já dado. Como a progressão conta lições satisfeitas,
// reabrir uma lição no meio do currículo faz o usuário perder o acesso à última que
// liberou, até concluí-la de novo.
export class ReopenLessonUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.lessonRepository.findById(lessonId)
    if (!lesson) throw new LessonNotFoundError('lição não encontrada')

    const progress = await this.lessonRepository.listProgressForUser(userId)
    const own = progress.find((p) => p.lessonId === lessonId)
    if (!own?.completedAt) throw new LessonNotReopenableError('a lição não está concluída')

    await this.lessonRepository.upsertProgress(userId, lessonId, {
      currentStep: 0,
      completedAt: null,
    })
  }
}
