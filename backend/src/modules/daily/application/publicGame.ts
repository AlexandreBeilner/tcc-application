import { MAX_WORD_ATTEMPTS } from '../domain/wordGuess'
import { dailyDay, dayStartInstant, addDays } from '../domain/gameDay'
import type { LoadedGame } from './dailyGameLoader'

// O jogo como o navegador o vê: a estrutura de cada cartão, nunca o gabarito (DP3). A resposta da
// palavra, `correctIndex` e a explicação da pergunta só saem depois de o cartão terminar.
export interface PublicGame {
  number: number
  date: string
  isToday: boolean
  // Quando o jogo seguinte aparece (00:00 UTC, 21h de Brasília).
  nextGameAt: string
  cards: {
    word: { length: number; maxAttempts: number }
    trivia: { question: string; options: string[] }
  }
}

export function toPublicGame(game: LoadedGame, now: Date): PublicGame {
  return {
    number: game.number,
    date: game.date,
    isToday: game.isToday,
    nextGameAt: dayStartInstant(addDays(dailyDay(now), 1)).toISOString(),
    cards: {
      word: { length: game.word.answer.length, maxAttempts: MAX_WORD_ATTEMPTS },
      trivia: { question: game.question.question, options: game.question.options },
    },
  }
}
