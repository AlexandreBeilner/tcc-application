import type { DailyResult } from './content'
import { CardAlreadyAnsweredError } from './errors'
import { MAX_WORD_ATTEMPTS } from './wordGuess'
import { calculateDailyXp } from './xp'

// Estado do jogo de um usuário logado (DI.2.2). Funções puras: quem garante que duas abas não
// gravam ao mesmo tempo é o repositório (`DailyResultRepository.update`, com trava de linha).

export function newResult(userId: string, puzzleNumber: number, now: Date): DailyResult {
  return {
    userId,
    puzzleNumber,
    wordGuesses: [],
    wordCorrect: null,
    questionChoice: null,
    questionCorrect: null,
    xpAwarded: 0,
    startedAt: now,
    completedAt: null,
  }
}

export interface WordGuessRecorded {
  next: DailyResult
  attempt: number
  finished: boolean
}

// Registra um palpite já avaliado. O cartão termina ao acertar ou na 6ª tentativa; palpite depois
// disso é recusado (não é gravado).
export function recordWordGuess(
  current: DailyResult,
  guess: string,
  solved: boolean,
): WordGuessRecorded {
  if (current.wordCorrect !== null) throw new CardAlreadyAnsweredError()
  const attempt = current.wordGuesses.length + 1
  const finished = solved || attempt >= MAX_WORD_ATTEMPTS
  return {
    attempt,
    finished,
    next: {
      ...current,
      wordGuesses: [...current.wordGuesses, guess],
      wordCorrect: finished ? solved : null,
    },
  }
}

export function recordTrivia(current: DailyResult, choice: number, correct: boolean): DailyResult {
  if (current.questionCorrect !== null) throw new CardAlreadyAnsweredError()
  return { ...current, questionChoice: choice, questionCorrect: correct }
}

export function isGameComplete(result: DailyResult): boolean {
  return result.wordCorrect !== null && result.questionCorrect !== null
}

export function correctCardCount(result: DailyResult): number {
  return [result.wordCorrect, result.questionCorrect].filter(Boolean).length
}

export interface Finalized {
  next: DailyResult
  // Verdadeiro só na chamada que fecha o jogo; é ela que concede XP e streak, uma vez.
  justCompleted: boolean
}

// Fecha o jogo quando os dois cartões foram respondidos. `awardsXp` vem do acesso (só o jogo do
// dia, concluído antes da virada): dia anterior fecha com 0 XP e não conta para sequência alguma.
export function finalizeResult(result: DailyResult, awardsXp: boolean, now: Date): Finalized {
  if (result.completedAt !== null || !isGameComplete(result)) {
    return { next: result, justCompleted: false }
  }
  const xp = awardsXp ? calculateDailyXp(correctCardCount(result)) : 0
  return { next: { ...result, completedAt: now, xpAwarded: xp }, justCompleted: true }
}
