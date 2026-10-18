import { InvalidOrderError } from '../../domain/errors'
import { evaluateTimelineOrder } from '../../domain/cardAnswers'
import { recordTimeline } from '../../domain/resultState'
import { timelineAnswerView, type TimelineAnswerView } from '../cardReveals'
import type { DailyGameLoader } from '../dailyGameLoader'
import type { DailyCompletion, DailyProgressRecorder } from '../dailyProgressRecorder'

export type TimelineAnswerResult = TimelineAnswerView & { completion?: DailyCompletion }

// `POST /daily/:number/cards/timeline/answer`.
export class AnswerTimelineUseCase {
  constructor(
    private readonly loader: DailyGameLoader,
    private readonly recorder: DailyProgressRecorder,
  ) {}

  async execute(input: {
    number: number
    order: string[]
    userId?: string
    now: Date
  }): Promise<TimelineAnswerResult> {
    const game = await this.loader.load(input.number, input.now)
    const evaluation = evaluateTimelineOrder(input.order, game.events)
    if (!evaluation.ok) throw new InvalidOrderError()
    const view = timelineAnswerView(game.events, evaluation.correct, evaluation.positionHits)
    if (input.userId === undefined) return view

    const recorded = await this.recorder.record(input.userId, game, input.now, (current) => ({
      next: recordTimeline(current, input.order, evaluation.correct),
      value: null,
    }))
    return recorded.completion ? { ...view, completion: recorded.completion } : view
  }
}
