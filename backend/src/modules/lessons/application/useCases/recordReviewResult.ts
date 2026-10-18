import { CheckpointNotFoundError, LessonNotFoundError } from '../../domain/errors'
import { isReviewDue, nextReview } from '../../domain/review'
import type { LessonRepository } from '../ports/lessonRepository'

export interface RecordReviewResultInput {
  userId: string
  lessonId: string
  checkpointId: string
  // Acertou sem errar antes nesta revisão.
  correct: boolean
}

export interface RecordReviewResultOutput {
  // `false` quando a pergunta não estava vencida (já respondida, ou fora da fila): nada muda e nada é cobrado.
  recorded: boolean
}

// Resultado de uma pergunta da revisão de 1 minuto (LJ.5.6). Acertar avança o estágio (1, 3 e 7 dias, e depois
// sai da fila); errar volta ao primeiro, sem perder nada. Só age em pergunta vencida e uma vez por vencimento,
// então repetir o envio ou responder depois do reagendamento é inofensivo. Nunca mexe em XP, streak nem missão.
export class RecordReviewResultUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: RecordReviewResultInput): Promise<RecordReviewResultOutput> {
    if (!(await this.lessonRepository.findById(input.lessonId))) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    const record = (
      await this.lessonRepository.listCheckpointsForUser(input.userId, input.lessonId)
    ).find((c) => c.checkpointId === input.checkpointId)
    if (!record) {
      throw new CheckpointNotFoundError('pergunta não encontrada nesta lição')
    }

    const now = this.clock()
    if (!isReviewDue(record.reviewDueAt, now)) {
      return { recorded: false }
    }
    const next = nextReview(record.reviewStage ?? 0, input.correct, now)
    const recorded = await this.lessonRepository.scheduleReview(
      input.userId,
      input.lessonId,
      input.checkpointId,
      next,
      record.reviewDueAt as Date,
    )
    return { recorded }
  }
}
