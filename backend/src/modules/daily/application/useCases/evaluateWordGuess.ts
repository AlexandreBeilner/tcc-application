import { AttemptRequiredError, InvalidGuessError, WordNotAcceptedError } from '../../domain/errors'
import { recordWordGuess } from '../../domain/resultState'
import {
  evaluateGuess,
  MAX_WORD_ATTEMPTS,
  normalizeWord,
  type LetterState,
} from '../../domain/wordGuess'
import { wordReveal, type WordReveal } from '../cardReveals'
import type { DailyGameLoader } from '../dailyGameLoader'
import type { DailyCompletion, DailyProgressRecorder } from '../dailyProgressRecorder'
import type { AcceptedWordRepository } from '../ports/acceptedWordRepository'

export interface WordGuessResult {
  // Cor de cada letra do palpite, avaliada aqui (DP3): o navegador nunca recebe a resposta.
  letters: LetterState[]
  solved: boolean
  attempt: number
  finished: boolean
  // Só quando o cartão terminou (acertou ou esgotou as tentativas).
  reveal?: WordReveal
  // Só logado, na chamada que fecha o jogo.
  completion?: DailyCompletion
}

// `POST /daily/:number/word/guess`. Sem login o servidor não guarda estado, então a tentativa
// corrente vem do cliente: é o que decide quando a resposta é revelada (trapacear só entrega a
// resposta a quem a pediu, sem XP em jogo, DI8). Logado, a tentativa é o que está gravado e o
// `attempt` do corpo é ignorado.
export class EvaluateWordGuessUseCase {
  constructor(
    private readonly loader: DailyGameLoader,
    private readonly acceptedWords: AcceptedWordRepository,
    private readonly recorder: DailyProgressRecorder,
  ) {}

  async execute(input: {
    number: number
    guess: string
    attempt?: number
    userId?: string
    now: Date
  }): Promise<WordGuessResult> {
    const game = await this.loader.load(input.number, input.now)
    const evaluation = evaluateGuess(input.guess, game.word.answer)
    if (!evaluation.ok) throw new InvalidGuessError(evaluation.reason)

    // Palavra fora da lista aceita é recusada sem gastar tentativa. A própria resposta sempre vale,
    // mesmo que a lista tenha ficado desatualizada.
    const normalized = normalizeWord(input.guess)
    if (!evaluation.solved && !(await this.acceptedWords.isAccepted(normalized))) {
      throw new WordNotAcceptedError()
    }

    const view = (attempt: number, finished: boolean) => ({
      letters: evaluation.letters,
      solved: evaluation.solved,
      attempt,
      finished,
      ...(finished ? { reveal: wordReveal(game.word) } : {}),
    })

    if (input.userId === undefined) {
      if (input.attempt === undefined) throw new AttemptRequiredError()
      return view(input.attempt, evaluation.solved || input.attempt >= MAX_WORD_ATTEMPTS)
    }

    const recorded = await this.recorder.record(input.userId, game, input.now, (current) => {
      const r = recordWordGuess(current, normalized, evaluation.solved)
      return { next: r.next, value: r }
    })
    return {
      ...view(recorded.value.attempt, recorded.value.finished),
      ...(recorded.completion ? { completion: recorded.completion } : {}),
    }
  }
}
