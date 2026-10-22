import { DailyGameNotFoundError, DailyGameUnavailableError } from '../../domain/errors'
import { dailyDay, gameNumberFor, resolveStatus } from '../../domain/gameDay'
import {
  triviaAnswerView,
  wordReveal,
  type TriviaAnswerView,
  type WordReveal,
} from '../cardReveals'
import type { DailyGameLoader } from '../dailyGameLoader'
import type { DailySettingsRepository } from '../ports/dailySettingsRepository'

export interface ArchivedGame {
  number: number
  date: string
  word: WordReveal & { length: number }
  trivia: {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
    sourceRef: string
    learnMore: TriviaAnswerView['learnMore']
  }
}

export interface ArchiveResult {
  games: ArchivedGame[]
}

// `GET /daily/archive`: os jogos já encerrados, do mais recente ao mais antigo, com o gabarito (o
// jogo foi encerrado, então a resposta deixa de ser segredo). Alimenta o build da landing (DI.3.4).
// O jogo do dia nunca entra, nem o futuro; um dia anterior sem jogo publicado é só um buraco.
// Desligado ou antes da estreia, a lista vem vazia (não revela nada).
export class GetArchiveUseCase {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly loader: DailyGameLoader,
  ) {}

  async execute(input: { now: Date }): Promise<ArchiveResult> {
    const { startDate } = await this.settings.get()
    const state = resolveStatus(startDate, dailyDay(input.now))
    if (state.status !== 'live') return { games: [] }

    const todayNumber = gameNumberFor(state.startDate, dailyDay(input.now)) as number
    const games: ArchivedGame[] = []
    for (let number = todayNumber - 1; number >= 1; number--) {
      try {
        const game = await this.loader.load(number, input.now)
        const trivia = triviaAnswerView(game.question, true)
        games.push({
          number: game.number,
          date: game.date,
          word: { ...wordReveal(game.word), length: game.word.answer.length },
          trivia: {
            question: game.question.question,
            options: game.question.options,
            correctIndex: trivia.correctIndex,
            explanation: trivia.explanation,
            sourceRef: trivia.sourceRef,
            learnMore: trivia.learnMore,
          },
        })
      } catch (err) {
        if (err instanceof DailyGameNotFoundError || err instanceof DailyGameUnavailableError)
          continue
        throw err
      }
    }
    return { games }
  }
}
