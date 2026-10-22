import type { DailyPuzzle, DailyQuestion, DailyWord } from '../domain/content'
import {
  DailyGameNotFoundError,
  DailyGameUnavailableError,
  DailyNotStartedError,
} from '../domain/errors'
import { dailyDay, dayStartInstant, resolveGameAccess } from '../domain/gameDay'
import type { DailyPuzzleRepository } from './ports/dailyPuzzleRepository'
import type { DailyQuestionRepository } from './ports/dailyQuestionRepository'
import type { DailySettingsRepository } from './ports/dailySettingsRepository'
import type { DailyWordRepository } from './ports/dailyWordRepository'

export interface LoadedGame {
  number: number
  date: string
  isToday: boolean
  // Só o jogo do dia vale XP e streak (seção 3.6).
  awardsXp: boolean
  puzzle: DailyPuzzle
  word: DailyWord
  question: DailyQuestion
}

// Resolve "este número é jogável agora?" e monta o jogo com o conteúdo de cada cartão. É o único
// ponto que decide acesso, então toda rota com número passa pela mesma regra (DI14): desligado,
// número futuro e número inexistente são o mesmo 404; antes da estreia, "ainda não começou".
//
// Serve só jogo publicado (ponto 058, decisão (b)): materializar não põe nada no ar, quem publica é
// o admin no painel (DI.5.1), depois de revisar. Jogo materializado e não publicado é, para o
// jogador, o mesmo que não existir.
export class DailyGameLoader {
  constructor(
    private readonly settings: DailySettingsRepository,
    private readonly puzzles: DailyPuzzleRepository,
    private readonly words: DailyWordRepository,
    private readonly questions: DailyQuestionRepository,
  ) {}

  async load(number: number, now: Date): Promise<LoadedGame> {
    const { startDate } = await this.settings.get()
    const access = resolveGameAccess(startDate, dailyDay(now), number)
    if (access.kind === 'off' || access.kind === 'not_found') throw new DailyGameNotFoundError()
    if (access.kind === 'not_started') {
      throw new DailyNotStartedError(access.startDate, dayStartInstant(access.startDate))
    }

    const puzzle = await this.puzzles.findByNumber(access.number)
    // Hoje sem jogo é falha da agenda (indisponível); dia anterior sem jogo é só um buraco no
    // arquivo, igual a um número que não existe.
    if (!puzzle || puzzle.publishedAt === null)
      throw access.isToday ? new DailyGameUnavailableError() : new DailyGameNotFoundError()
    return this.assemble(puzzle, access)
  }

  private async assemble(
    puzzle: DailyPuzzle,
    access: { number: number; date: string; isToday: boolean; awardsXp: boolean },
  ): Promise<LoadedGame> {
    const [word, question] = await Promise.all([
      this.words.findById(puzzle.wordId),
      this.questions.findById(puzzle.questionId),
    ])
    if (!word || !question) throw new DailyGameUnavailableError()

    return {
      number: access.number,
      date: access.date,
      isToday: access.isToday,
      awardsXp: access.awardsXp,
      puzzle,
      word,
      question,
    }
  }
}
