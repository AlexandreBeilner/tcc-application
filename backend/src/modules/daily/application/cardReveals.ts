import type { DailyQuestion, DailyWord, LearnMore } from '../domain/content'

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
