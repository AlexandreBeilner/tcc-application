import type { LearnMore } from '../../domain/content'
import { InvalidChoiceError } from '../../domain/errors'
import { evaluateChoice } from '../../domain/cardAnswers'
import type { DailyGameLoader } from '../dailyGameLoader'

export interface TriviaAnswerResult {
  correct: boolean
  correctIndex: number
  explanation: string
  sourceRef: string
  learnMore: LearnMore | null
}

// `POST /daily/:number/cards/trivia/answer`: uma tentativa por cartão. O gabarito só volta aqui,
// junto da explicação, depois de o cartão ser respondido.
export class AnswerTriviaUseCase {
  constructor(private readonly loader: DailyGameLoader) {}

  async execute(input: { number: number; choice: number; now: Date }): Promise<TriviaAnswerResult> {
    const { question } = await this.loader.load(input.number, input.now)
    const evaluation = evaluateChoice(input.choice, question.correctIndex, question.options.length)
    if (!evaluation.ok) throw new InvalidChoiceError()
    return {
      correct: evaluation.correct,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      sourceRef: question.sourceRef,
      learnMore: question.learnMore,
    }
  }
}
