import type { DailyEvent, DailyQuestion, DailyWord, LearnMore } from '../domain/content'

// O que cada cartão mostra depois de terminar. Único lugar que monta o gabarito de resposta, usado
// pela resposta de cada cartão e pelo estado salvo (`GET /daily/:number/me`).

export interface WordReveal {
  answer: string
  definition: string
  learnMore: LearnMore | null
}

export function wordReveal(word: DailyWord): WordReveal {
  return { answer: word.display, definition: word.definition, learnMore: word.learnMore }
}

export interface TriviaAnswerView {
  correct: boolean
  correctIndex: number
  explanation: string
  sourceRef: string
  learnMore: LearnMore | null
}

export function triviaAnswerView(question: DailyQuestion, correct: boolean): TriviaAnswerView {
  return {
    correct,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    sourceRef: question.sourceRef,
    learnMore: question.learnMore,
  }
}

export interface TimelineEventView {
  id: string
  label: string
  year: number
  explanation: string
  sourceRef: string
  learnMore: LearnMore | null
}

export interface TimelineAnswerView {
  correct: boolean
  positionHits: boolean[]
  events: TimelineEventView[]
}

// Eventos na ordem cronológica certa, já com o ano (só agora deixa de ser gabarito).
export function timelineAnswerView(
  events: readonly DailyEvent[],
  correct: boolean,
  positionHits: boolean[],
): TimelineAnswerView {
  return {
    correct,
    positionHits,
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
