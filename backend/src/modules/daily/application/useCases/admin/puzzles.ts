import type { DailyPuzzle, DailyQuestion, DailyWord } from '../../../domain/content'
import {
  DailyAdminConflictError,
  DailyAdminInvalidError,
  DailyAdminNotFoundError,
} from '../../../domain/errors'
import { dailyDay } from '../../../domain/gameDay'
import type { AdminPuzzleView } from '../../adminViews'
import type { DailyPuzzleRepository, PuzzleCardChange } from '../../ports/dailyPuzzleRepository'
import type { DailyQuestionRepository } from '../../ports/dailyQuestionRepository'
import type { DailyWordRepository } from '../../ports/dailyWordRepository'

interface PuzzleContent {
  puzzle: DailyPuzzle
  word: DailyWord
  question: DailyQuestion
}

class PuzzleContentLoader {
  constructor(
    private readonly puzzles: DailyPuzzleRepository,
    private readonly words: DailyWordRepository,
    private readonly questions: DailyQuestionRepository,
  ) {}

  async load(number: number): Promise<PuzzleContent> {
    const puzzle = await this.puzzles.findByNumber(number)
    if (!puzzle) throw new DailyAdminNotFoundError('jogo não encontrado')
    const [word, question] = await Promise.all([
      this.words.findById(puzzle.wordId),
      this.questions.findById(puzzle.questionId),
    ])
    if (!word || !question) {
      throw new DailyAdminNotFoundError('o jogo aponta para conteúdo que não existe mais')
    }
    return { puzzle, word, question }
  }
}

function problemsOf(content: PuzzleContent): string[] {
  const problems: string[] = []
  if (!content.word.active) problems.push('a palavra do dia está desativada')
  if (!content.question.active) problems.push('a pergunta do dia está desativada')
  return problems
}

// Prévia de qualquer dia que já tenha jogo materializado, futuro inclusive, como o jogador verá,
// mais o gabarito. Rota de admin: as rotas públicas nunca devolvem isto (seção 3.5).
export class GetAdminPuzzleUseCase {
  private readonly loader: PuzzleContentLoader

  constructor(
    puzzles: DailyPuzzleRepository,
    words: DailyWordRepository,
    questions: DailyQuestionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.loader = new PuzzleContentLoader(puzzles, words, questions)
  }

  async execute(number: number): Promise<AdminPuzzleView> {
    const content = await this.loader.load(number)
    const { puzzle } = content
    const warnings = problemsOf(content)
    return {
      number: puzzle.number,
      date: puzzle.gameDate,
      isTodayOrPast: puzzle.gameDate <= dailyDay(this.now()),
      publishedAt: puzzle.publishedAt,
      origins: { word: puzzle.wordOrigin, question: puzzle.questionOrigin },
      word: content.word,
      question: content.question,
      warnings,
    }
  }
}

// Publica jogos (rotas públicas só servem jogo publicado, ponto 058). Sem números, publica todos
// os que ainda não estão no ar. Não há etapa de revisão: o conteúdo nasce pronto.
export class PublishPuzzlesUseCase {
  constructor(
    private readonly puzzles: DailyPuzzleRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(numbers?: number[]): Promise<{ published: number[] }> {
    const now = this.now()
    if (numbers === undefined) {
      return { published: await this.puzzles.publishPending('1970-01-01', now) }
    }
    const published: number[] = []
    for (const number of [...new Set(numbers)].sort((a, b) => a - b)) {
      const puzzle = await this.puzzles.findByNumber(number)
      if (!puzzle) throw new DailyAdminNotFoundError(`jogo ${number} não encontrado`)
      if (puzzle.publishedAt !== null) continue
      await this.puzzles.markPublished(number, now)
      published.push(number)
    }
    return { published }
  }
}

export type ReplaceCardInput =
  { card: 'word'; wordId: string } | { card: 'question'; questionId: string }

// Troca um cartão de um dia (origem passa a `manual`). Jogo publicado só muda com confirmação
// explícita.
export class ReplacePuzzleCardUseCase {
  constructor(
    private readonly puzzles: DailyPuzzleRepository,
    private readonly words: DailyWordRepository,
    private readonly questions: DailyQuestionRepository,
  ) {}

  async execute(
    number: number,
    input: ReplaceCardInput,
    confirmPublished: boolean,
  ): Promise<{ number: number }> {
    const puzzle = await this.puzzles.findByNumber(number)
    if (!puzzle) throw new DailyAdminNotFoundError('jogo não encontrado')
    if (puzzle.publishedAt !== null && !confirmPublished) {
      throw new DailyAdminConflictError(
        'confirmation_required',
        'o jogo já está publicado; confirme para trocar o cartão',
      )
    }
    const change = await this.toChange(input)
    await this.puzzles.updateCard(number, change)
    return { number }
  }

  private async toChange(input: ReplaceCardInput): Promise<PuzzleCardChange> {
    if (input.card === 'word') {
      const word = await this.words.findById(input.wordId)
      if (!word) throw new DailyAdminNotFoundError('palavra não encontrada')
      if (!word.active) throw new DailyAdminInvalidError(['a palavra está desativada'])
      return { card: 'word', wordId: word.id }
    }
    const question = await this.questions.findById(input.questionId)
    if (!question) throw new DailyAdminNotFoundError('pergunta não encontrada')
    if (!question.active) throw new DailyAdminInvalidError(['a pergunta está desativada'])
    return { card: 'question', questionId: question.id }
  }
}
