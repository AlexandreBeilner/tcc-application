import { evaluateGuess, type LetterState } from '../../domain/wordGuess'
import {
  triviaAnswerView,
  wordReveal,
  type TriviaAnswerView,
  type WordReveal,
} from '../cardReveals'
import type { DailyGameLoader } from '../dailyGameLoader'
import type { DailyResultRepository } from '../ports/dailyResultRepository'

export interface MyGameState {
  number: number
  completed: boolean
  xpAwarded: number
  word: {
    // As cores são recalculadas contra a resposta; o gabarito em si só sai com o cartão terminado.
    guesses: { guess: string; letters: LetterState[] }[]
    finished: boolean
    solved: boolean
    reveal?: WordReveal
  }
  trivia: { answered: false } | ({ answered: true; choice: number } & TriviaAnswerView)
}

// `GET /daily/:number/me`: o estado salvo do usuário naquele jogo, para redesenhar a tela em
// qualquer aparelho (seção 3.4). Sem jogada gravada, tudo vem como não respondido.
export class GetMyGameStateUseCase {
  constructor(
    private readonly loader: DailyGameLoader,
    private readonly results: DailyResultRepository,
  ) {}

  async execute(input: { userId: string; number: number; now: Date }): Promise<MyGameState> {
    const game = await this.loader.load(input.number, input.now)
    const saved = await this.results.find(input.userId, game.number)

    const guesses = (saved?.wordGuesses ?? []).map((guess) => {
      const evaluation = evaluateGuess(guess, game.word.answer)
      return { guess, letters: evaluation.ok ? evaluation.letters : [] }
    })
    const wordFinished = saved?.wordCorrect != null

    let trivia: MyGameState['trivia'] = { answered: false }
    if (saved && saved.questionCorrect !== null && saved.questionChoice !== null) {
      trivia = {
        answered: true,
        choice: saved.questionChoice,
        ...triviaAnswerView(game.question, saved.questionCorrect),
      }
    }

    return {
      number: game.number,
      completed: saved?.completedAt != null,
      xpAwarded: saved?.xpAwarded ?? 0,
      word: {
        guesses,
        finished: wordFinished,
        solved: saved?.wordCorrect === true,
        ...(wordFinished ? { reveal: wordReveal(game.word) } : {}),
      },
      trivia,
    }
  }
}
