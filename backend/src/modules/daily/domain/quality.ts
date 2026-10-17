import type { DailyResult } from './content'
import { CARDS_PER_GAME } from './cards'
import { correctCardCount } from './resultState'

// Números das conquistas por qualidade do Diário (DI.6.1). Só entra jogo concluído dentro do
// próprio dia: é o `xpAwarded > 0` que marca isso (dia anterior ou depois da virada fecha com 0),
// a mesma regra do XP e da sequência (`computeStreaks`), então rejogar o passado não rende nada.
export interface DailyQuality {
  // Jogos em que a palavra saiu no primeiro palpite.
  wordFirstTryGames: number
  // Jogos com os três cartões certos.
  perfectDays: number
  // Maior sequência de dias seguidos (número de jogo seguido) com a Linha do tempo certa.
  bestTimelineRun: number
}

export function computeDailyQuality(results: readonly DailyResult[]): DailyQuality {
  const counted = results.filter((r) => r.completedAt !== null && r.xpAwarded > 0)

  const timelineDays = [
    ...new Set(counted.filter((r) => r.timelineCorrect === true).map((r) => r.puzzleNumber)),
  ].sort((a, b) => a - b)
  let best = 0
  let run = 0
  let previous: number | null = null
  for (const day of timelineDays) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }

  return {
    wordFirstTryGames: counted.filter((r) => r.wordCorrect === true && r.wordGuesses.length === 1)
      .length,
    perfectDays: counted.filter((r) => correctCardCount(r) === CARDS_PER_GAME).length,
    bestTimelineRun: best,
  }
}
