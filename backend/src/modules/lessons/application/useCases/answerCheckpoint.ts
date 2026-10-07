import {
  CheckpointNotFoundError,
  InvalidCheckpointResponseError,
  LessonLockedError,
  LessonNotFoundError,
} from '../../domain/errors'
import { buildProgression } from '../../domain/lesson'
import {
  findCheckBlock,
  isCheckCorrect,
  isValidCheckResponse,
} from '../../domain/widgets/lessonBlocks'
import type { CheckResponse } from '../../domain/widgets/lessonBlocks'
import type { LessonRepository } from '../ports/lessonRepository'

export interface AnswerCheckpointInput extends CheckResponse {
  userId: string
  lessonId: string
  checkpointId: string
}

export interface AnswerCheckpointResult {
  correct: boolean
  attempts: number
  // Acertou sem erro antes.
  firstTry: boolean
  // Alternativas erradas já tentadas (vazio em pergunta numérica e em revisão).
  wrongOptions: number[]
  // Só em acerto: errar nunca entrega o gabarito nem a explicação (D3).
  explanation?: string
}

// Pergunta intermediária da lição (`check`, RC.3.2): mesmas regras da pergunta
// da Micro-decisão (RC.2.3). Tentativas ilimitadas, erro só desativa a
// alternativa, explicação (e o gabarito implícito) só no acerto, e o XP não
// muda (D1: a lição continua valendo o valor fixo). Lição já concluída, ou
// checkpoint já resolvido, responde sem gravar (revisão sem estado).
export class AnswerCheckpointUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: AnswerCheckpointInput): Promise<AnswerCheckpointResult> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const block = findCheckBlock(lesson.blocks, input.checkpointId)
    if (!block) {
      throw new CheckpointNotFoundError('pergunta não encontrada nesta lição')
    }
    if (!isValidCheckResponse(block, input)) {
      throw new InvalidCheckpointResponseError('resposta inválida pra esta pergunta')
    }

    const correct = isCheckCorrect(block, input)
    const [progress, allLessons] = await Promise.all([
      this.lessonRepository.listProgressForUser(input.userId),
      this.lessonRepository.listAll(),
    ])
    const completed = progress.find((p) => p.lessonId === input.lessonId)?.completedAt != null

    if (!completed && !buildProgression(allLessons, progress).isUnlocked(lesson.id)) {
      throw new LessonLockedError('lição bloqueada')
    }

    const existing = (
      await this.lessonRepository.listCheckpointsForUser(input.userId, input.lessonId)
    ).find((c) => c.checkpointId === input.checkpointId)
    const readOnly = completed || existing?.solvedAt != null
    const explanation = correct ? { explanation: block.explanation } : {}

    if (readOnly) {
      return {
        correct,
        attempts: existing?.attempts ?? 0,
        firstTry: correct && (existing?.attempts ?? 0) <= 1,
        wrongOptions: [],
        ...explanation,
      }
    }

    const saved = await this.lessonRepository.recordCheckpointAnswer(
      input.userId,
      input.lessonId,
      input.checkpointId,
      {
        choice: block.kind === 'numeric' ? null : (input.selectedOption ?? null),
        correct,
        answeredAt: this.clock(),
      },
    )

    return {
      correct,
      attempts: saved.attempts,
      firstTry: correct && saved.attempts === 1,
      wrongOptions: saved.wrongOptions,
      ...explanation,
    }
  }
}
