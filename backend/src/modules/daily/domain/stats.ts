import type { DailyResult } from './content'
import { MAX_WORD_ATTEMPTS } from './wordGuess'

export interface CardStats {
  played: number
  correct: number
  // 0 a 100, arredondado; 0 sem jogos.
  accuracy: number
}

export interface DailyStats {
  games: number
  word: CardStats
  trivia: CardStats
  timeline: CardStats
  // Termo: quantas vezes acertou em N tentativas (chaves "1" a "6") e quantas errou.
  wordAttempts: { distribution: Record<string, number>; failed: number }
  currentStreak: number
  longestStreak: number
}

function cardStats(values: (boolean | null)[]): CardStats {
  const answered = values.filter((v): v is boolean => v !== null)
  const correct = answered.filter(Boolean).length
  return {
    played: answered.length,
    correct,
    accuracy: answered.length === 0 ? 0 : Math.round((correct / answered.length) * 100),
  }
}

// Sequência do Diário: jogos seguidos concluídos no próprio dia. Quem marca "no próprio dia" é o
// XP concedido (só o jogo do dia, antes da virada, vale XP); dia anterior jogado depois não conta
// (seção 3.6). A sequência atual segue viva se o jogo de hoje ainda não foi concluído, desde que
// o de ontem tenha sido.
export function computeStreaks(
  results: readonly DailyResult[],
  todayNumber: number | null,
): { currentStreak: number; longestStreak: number } {
  const days = [...new Set(results.filter((r) => r.xpAwarded > 0).map((r) => r.puzzleNumber))].sort(
    (a, b) => a - b,
  )
  let longest = 0
  let run = 0
  let previous: number | null = null
  for (const day of days) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }

  let current = 0
  if (todayNumber !== null) {
    const done = new Set(days)
    let cursor = done.has(todayNumber) ? todayNumber : todayNumber - 1
    while (done.has(cursor)) {
      current += 1
      cursor -= 1
    }
  }
  return { currentStreak: current, longestStreak: longest }
}

export function computeStats(
  results: readonly DailyResult[],
  todayNumber: number | null,
): DailyStats {
  const distribution: Record<string, number> = {}
  for (let i = 1; i <= MAX_WORD_ATTEMPTS; i++) distribution[String(i)] = 0
  let failed = 0
  for (const r of results) {
    if (r.wordCorrect === true) distribution[String(r.wordGuesses.length)] += 1
    else if (r.wordCorrect === false) failed += 1
  }
  return {
    games: results.filter((r) => r.completedAt !== null).length,
    word: cardStats(results.map((r) => r.wordCorrect)),
    trivia: cardStats(results.map((r) => r.questionCorrect)),
    timeline: cardStats(results.map((r) => r.timelineCorrect)),
    wordAttempts: { distribution, failed },
    ...computeStreaks(results, todayNumber),
  }
}
