import type { LearnMore } from '../../domain/content'
import { InvalidOrderError } from '../../domain/errors'
import { evaluateTimelineOrder } from '../../domain/cardAnswers'
import type { DailyGameLoader } from '../dailyGameLoader'

export interface TimelineAnswerResult {
  correct: boolean
  // Posição a posição da ordem enviada.
  positionHits: boolean[]
  // A ordem certa, já com ano e explicação (só agora o ano deixa de ser gabarito).
  events: {
    id: string
    label: string
    year: number
    explanation: string
    sourceRef: string
    learnMore: LearnMore | null
  }[]
}

// `POST /daily/:number/cards/timeline/answer`.
export class AnswerTimelineUseCase {
  constructor(private readonly loader: DailyGameLoader) {}

  async execute(input: {
    number: number
    order: string[]
    now: Date
  }): Promise<TimelineAnswerResult> {
    const { events } = await this.loader.load(input.number, input.now)
    const evaluation = evaluateTimelineOrder(input.order, events)
    if (!evaluation.ok) throw new InvalidOrderError()
    return {
      correct: evaluation.correct,
      positionHits: evaluation.positionHits,
      events: [...events]
        .sort((a, b) => a.year - b.year)
        .map((e) => ({
          id: e.id,
          label: e.label,
          year: e.year,
          explanation: e.explanation,
          sourceRef: e.sourceRef,
          learnMore: e.learnMore,
        })),
    }
  }
}
