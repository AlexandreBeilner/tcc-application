import { InvalidChoiceError } from '../../domain/errors'
import { evaluateChoice } from '../../domain/cardAnswers'
import { recordTrivia } from '../../domain/resultState'
import { triviaAnswerView, type TriviaAnswerView } from '../cardReveals'
import type { DailyGameLoader } from '../dailyGameLoader'
import type { DailyCompletion, DailyProgressRecorder } from '../dailyProgressRecorder'

export type TriviaAnswerResult = TriviaAnswerView & { completion?: DailyCompletion }

// `POST /daily/:number/cards/trivia/answer`: uma tentativa por cartão. O gabarito só volta aqui,
// junto da explicação, depois de o cartão ser respondido. Logado, a resposta fica gravada e um
// segundo envio é recusado (`CardAlreadyAnsweredError`).
export class AnswerTriviaUseCase {
  constructor(
    private readonly loader: DailyGameLoader,
    private readonly recorder: DailyProgressRecorder,
  ) {}

  async execute(input: {
    number: number
    choice: number
    userId?: string
    now: Date
  }): Promise<TriviaAnswerResult> {
    const game = await this.loader.load(input.number, input.now)
    const { question } = game
    const evaluation = evaluateChoice(input.choice, question.correctIndex, question.options.length)
    if (!evaluation.ok) throw new InvalidChoiceError()
    const view = triviaAnswerView(question, evaluation.correct)
    if (input.userId === undefined) return view

    const recorded = await this.recorder.record(input.userId, game, input.now, (current) => ({
      next: recordTrivia(current, input.choice, evaluation.correct),
      value: null,
    }))
    return recorded.completion ? { ...view, completion: recorded.completion } : view
  }
}
