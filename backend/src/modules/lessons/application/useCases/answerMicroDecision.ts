import {
  InvalidMicroDecisionOptionError,
  LessonLockedError,
  LessonNotFoundError,
  LessonStepOutOfOrderError,
  NoMicroDecisionError,
} from '../../domain/errors'
import { isUnlocked } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface AnswerMicroDecisionInput {
  userId: string
  lessonId: string
  selectedOption: number
}

export interface AnswerMicroDecisionResult {
  correct: boolean
  attempts: number
  // Acertou na primeira resposta (nenhum erro antes).
  firstTry: boolean
  // Alternativas erradas já tentadas, que o player desativa. Vazio em revisão.
  wrongOptions: number[]
  // Só em acerto: errar nunca entrega o gabarito (decisão D3).
  correctOptionLabel?: string
}

// Pergunta da Micro-decisão que só libera o avanço quando acertada (RC.2.3,
// decisões D1/D3/D4): tentativas ilimitadas, sem dica por alternativa; o único
// retorno do erro é a alternativa errada ficar desativada, e o gabarito só
// aparece junto do acerto. A primeira escolha é imutável
// (`microDecisionSelectedOption`), então conquistas e missões de "acerto de
// primeira" seguem lendo o mesmo campo de sempre.
//
// Lição já concluída, ou pergunta já resolvida, responde sem gravar nada
// (revisão sem estado): o veredito sai da mesma função pura de domínio.
export class AnswerMicroDecisionUseCase {
  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: AnswerMicroDecisionInput): Promise<AnswerMicroDecisionResult> {
    const lesson = await this.lessonRepository.findById(input.lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }

    const { microDecisionOptions, microDecisionCorrectOption } = lesson
    if (!microDecisionOptions || microDecisionCorrectOption === null) {
      throw new NoMicroDecisionError('esta lição não tem pergunta com alternativas')
    }
    if (input.selectedOption >= microDecisionOptions.length) {
      throw new InvalidMicroDecisionOptionError('opção de micro-decisão inválida')
    }

    const correct = input.selectedOption === microDecisionCorrectOption
    const correctOptionLabel = correct
      ? microDecisionOptions[microDecisionCorrectOption]
      : undefined

    const progress = await this.lessonRepository.listProgressForUser(input.userId)
    const completedCount = progress.filter((p) => p.completedAt !== null).length
    const own = progress.find((p) => p.lessonId === input.lessonId)
    const readOnly = own?.completedAt != null || own?.microDecisionSolvedAt != null

    if (!readOnly) {
      if (!isUnlocked(lesson.sortOrder, completedCount)) {
        throw new LessonLockedError('lição bloqueada')
      }
      // Só depois de sair do Cenário: a linha de progresso é criada ao avançar
      // do passo 0 pro 1.
      if (!own || own.currentStep < 1) {
        throw new LessonStepOutOfOrderError('passo fora de ordem')
      }
    }

    if (readOnly) {
      return {
        correct,
        attempts: own?.microDecisionAttempts ?? 0,
        firstTry: correct && (own?.microDecisionAttempts ?? 0) <= 1,
        wrongOptions: [],
        ...(correctOptionLabel !== undefined ? { correctOptionLabel } : {}),
      }
    }

    const saved = await this.lessonRepository.recordMicroDecisionAnswer(
      input.userId,
      input.lessonId,
      {
        selectedOption: input.selectedOption,
        correct,
        answeredAt: this.clock(),
      },
    )
    // Perdeu a corrida pra uma resposta concorrente que já resolveu: trata
    // como leitura, sem escrever de novo.
    const state = saved ?? own
    const attempts = state?.microDecisionAttempts ?? 0

    return {
      correct,
      attempts,
      firstTry: correct && attempts === 1,
      wrongOptions: state?.microDecisionWrongOptions ?? [],
      ...(correctOptionLabel !== undefined ? { correctOptionLabel } : {}),
    }
  }
}
