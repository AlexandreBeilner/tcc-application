import { isValidCardPosition, reachDay } from '../../domain/cardReach'
import {
  InvalidCardPositionError,
  LessonLockedError,
  LessonNotFoundError,
  LessonStepOutOfOrderError,
} from '../../domain/errors'
import { buildProgression } from '../../domain/lesson'
import type { LessonCardReachRepository } from '../ports/lessonCardReachRepository'
import type { LessonRepository } from '../ports/lessonRepository'

export interface RecordCardReachInput {
  userId: string
  lessonId: string
  phase: number
  cardIndex: number
}

export interface RecordCardReachResult {
  recorded: boolean
}

// O player avisa que a pessoa chegou a um cartão (LJ.5.1). Não conta lição bloqueada, e a fase não
// pode passar do passo que o servidor já gravou: sem isso um cliente inflaria os cartões finais
// sem ter feito a lição. Lição concluída é aceita de propósito: a tela final só aparece depois de o
// servidor concluir a lição, então é assim que ela entra no funil. A revisão não chega aqui porque
// o player não reporta em revisão; e quem repete cartão já visto não conta de novo (o repositório só
// avança o cartão mais alto).
export class RecordCardReachUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly cardReach: LessonCardReachRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: RecordCardReachInput): Promise<RecordCardReachResult> {
    const position = { phase: input.phase, cardIndex: input.cardIndex }
    if (!isValidCardPosition(position)) {
      throw new InvalidCardPositionError('posição de cartão inválida')
    }

    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const [progress, allLessons] = await Promise.all([
      this.lessonRepository.listProgressForUser(input.userId),
      this.lessonRepository.listAll(),
    ])
    const own = progress.find((p) => p.lessonId === input.lessonId)
    if (own?.completedAt == null && !buildProgression(allLessons, progress).isUnlocked(lesson.id)) {
      throw new LessonLockedError('lição bloqueada')
    }
    if (input.phase > (own?.currentStep ?? 0)) {
      throw new LessonStepOutOfOrderError('o passo ainda não foi alcançado')
    }

    const recorded = await this.cardReach.recordReach({
      userId: input.userId,
      lessonId: input.lessonId,
      position,
      day: reachDay(this.clock()),
    })
    return { recorded }
  }
}
