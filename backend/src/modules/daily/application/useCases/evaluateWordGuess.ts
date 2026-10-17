import type { LearnMore } from '../../domain/content'
import { InvalidGuessError, WordNotAcceptedError } from '../../domain/errors'
import {
  evaluateGuess,
  MAX_WORD_ATTEMPTS,
  normalizeWord,
  type LetterState,
} from '../../domain/wordGuess'
import type { DailyGameLoader } from '../dailyGameLoader'
import type { AcceptedWordRepository } from '../ports/acceptedWordRepository'

export interface WordGuessResult {
  // Cor de cada letra do palpite, avaliada aqui (DP3): o navegador nunca recebe a resposta.
  letters: LetterState[]
  solved: boolean
  attempt: number
  finished: boolean
  // Só quando o cartão terminou (acertou ou esgotou as tentativas).
  reveal?: { answer: string; definition: string; learnMore: LearnMore | null }
}

// `POST /daily/:number/word/guess`. Sem login o servidor não guarda estado, então a tentativa
// corrente vem do cliente: é o que decide quando a resposta é revelada. Trapacear aqui só entrega
// a resposta a quem a pediu (sem login não há XP, DI8).
export class EvaluateWordGuessUseCase {
  constructor(
    private readonly loader: DailyGameLoader,
    private readonly acceptedWords: AcceptedWordRepository,
  ) {}

  async execute(input: {
    number: number
    guess: string
    attempt: number
    now: Date
  }): Promise<WordGuessResult> {
    const game = await this.loader.load(input.number, input.now)
    const evaluation = evaluateGuess(input.guess, game.word.answer)
    if (!evaluation.ok) throw new InvalidGuessError(evaluation.reason)

    // Palavra fora da lista aceita é recusada sem gastar tentativa. A própria resposta sempre vale,
    // mesmo que a lista tenha ficado desatualizada.
    if (!evaluation.solved && !(await this.acceptedWords.isAccepted(normalizeWord(input.guess)))) {
      throw new WordNotAcceptedError()
    }

    const finished = evaluation.solved || input.attempt >= MAX_WORD_ATTEMPTS
    return {
      letters: evaluation.letters,
      solved: evaluation.solved,
      attempt: input.attempt,
      finished,
      ...(finished
        ? {
            reveal: {
              answer: game.word.display,
              definition: game.word.definition,
              learnMore: game.word.learnMore,
            },
          }
        : {}),
    }
  }
}
