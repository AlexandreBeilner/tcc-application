import type { DailyEvent, DailyPuzzle, DailyQuestion, DailyWord } from '../../../domain/content'
import {
  DailyAdminConflictError,
  DailyAdminInvalidError,
  DailyAdminNotFoundError,
} from '../../../domain/errors'
import { dailyDay } from '../../../domain/gameDay'
import { generateTimeline, TIMELINE_SIZE } from '../../../domain/timelineGenerator'
import type { AdminPuzzleView } from '../../adminViews'
import type { DailyEventRepository } from '../../ports/dailyEventRepository'
import type { DailyPuzzleRepository, PuzzleCardChange } from '../../ports/dailyPuzzleRepository'
import type { DailyQuestionRepository } from '../../ports/dailyQuestionRepository'
import type { DailyWordRepository } from '../../ports/dailyWordRepository'

interface PuzzleContent {
  puzzle: DailyPuzzle
  word: DailyWord
  question: DailyQuestion
  events: DailyEvent[]
}

class PuzzleContentLoader {
  constructor(
    private readonly puzzles: DailyPuzzleRepository,
    private readonly words: DailyWordRepository,
    private readonly questions: DailyQuestionRepository,
    private readonly events: DailyEventRepository,
  ) {}

  async load(number: number): Promise<PuzzleContent> {
    const puzzle = await this.puzzles.findByNumber(number)
    if (!puzzle) throw new DailyAdminNotFoundError('jogo não encontrado')
    const [word, question, events] = await Promise.all([
      this.words.findById(puzzle.wordId),
      this.questions.findById(puzzle.questionId),
      this.events.findManyByIds(puzzle.timelineEventIds),
    ])
    const byId = new Map(events.map((e) => [e.id, e]))
    const ordered = puzzle.timelineEventIds.map((id) => byId.get(id))
    if (!word || !question || ordered.some((e) => !e)) {
      throw new DailyAdminNotFoundError('o jogo aponta para conteúdo que não existe mais')
    }
    return { puzzle, word, question, events: ordered as DailyEvent[] }
  }
}

function problemsOf(content: PuzzleContent): string[] {
  const problems: string[] = []
  if (!content.word.active) problems.push('a palavra do dia está desativada')
  if (!content.question.active) problems.push('a pergunta do dia está desativada')
  if (content.events.some((e) => !e.active)) problems.push('há evento desativado na Linha do tempo')
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
    events: DailyEventRepository,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.loader = new PuzzleContentLoader(puzzles, words, questions, events)
  }

  async execute(number: number): Promise<AdminPuzzleView> {
    const content = await this.loader.load(number)
    const { puzzle } = content
    const warnings = problemsOf(content)
    if (!content.question.reviewedAt || content.events.some((e) => !e.reviewedAt)) {
      warnings.push('há pergunta ou evento deste dia ainda sem revisão')
    }
    return {
      number: puzzle.number,
      date: puzzle.gameDate,
      isTodayOrPast: puzzle.gameDate <= dailyDay(this.now()),
      reviewedAt: puzzle.reviewedAt,
      publishedAt: puzzle.publishedAt,
      origins: {
        word: puzzle.wordOrigin,
        question: puzzle.questionOrigin,
        timeline: puzzle.timelineOrigin,
      },
      word: content.word,
      question: content.question,
      events: content.events,
      correctOrder: [...content.events].sort((a, b) => a.year - b.year).map((e) => e.id),
      warnings,
    }
  }
}

// Marca o dia como revisado: o admin viu a prévia, conferiu as fontes. Os itens do dia (pergunta e
// eventos) entram como revistos junto, porque foi isso que ele viu.
export class ReviewPuzzleUseCase {
  private readonly loader: PuzzleContentLoader

  constructor(
    private readonly puzzles: DailyPuzzleRepository,
    words: DailyWordRepository,
    private readonly questions: DailyQuestionRepository,
    private readonly events: DailyEventRepository,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.loader = new PuzzleContentLoader(puzzles, words, questions, events)
  }

  async execute(actorId: string, number: number): Promise<{ number: number }> {
    const content = await this.loader.load(number)
    const problems = problemsOf(content)
    if (problems.length > 0) throw new DailyAdminInvalidError(problems)
    const now = this.now()
    await this.puzzles.markReviewed(number, actorId, now)
    await this.questions.markReviewed([content.question.id], actorId, now)
    await this.events.markReviewed(
      content.events.map((e) => e.id),
      actorId,
      now,
    )
    return { number }
  }
}

// Publica jogos já revisados (rotas públicas só servem jogo publicado, ponto 058). Sem números,
// publica todos os revisados que ainda não estão no ar.
export class PublishPuzzlesUseCase {
  constructor(
    private readonly puzzles: DailyPuzzleRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(numbers?: number[]): Promise<{ published: number[] }> {
    const now = this.now()
    if (numbers === undefined) {
      return { published: await this.puzzles.publishReviewed('1970-01-01', now) }
    }
    const published: number[] = []
    for (const number of [...new Set(numbers)].sort((a, b) => a - b)) {
      const puzzle = await this.puzzles.findByNumber(number)
      if (!puzzle) throw new DailyAdminNotFoundError(`jogo ${number} não encontrado`)
      if (puzzle.reviewedAt === null) {
        throw new DailyAdminConflictError('not_reviewed', `o jogo ${number} ainda não foi revisado`)
      }
      if (puzzle.publishedAt !== null) continue
      await this.puzzles.markPublished(number, now)
      published.push(number)
    }
    return { published }
  }
}

export type ReplaceCardInput =
  | { card: 'word'; wordId: string }
  | { card: 'question'; questionId: string }
  | { card: 'timeline'; eventIds: string[] }

// Troca um cartão de um dia (origem passa a `manual`) e zera a revisão do dia. Jogo publicado só
// muda com confirmação explícita; nesse caso a edição vale como revisão de quem confirmou.
export class ReplacePuzzleCardUseCase {
  constructor(
    private readonly puzzles: DailyPuzzleRepository,
    private readonly words: DailyWordRepository,
    private readonly questions: DailyQuestionRepository,
    private readonly events: DailyEventRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    actorId: string,
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
    const change = await this.toChange(puzzle, input)
    await this.puzzles.updateCard(number, change)
    if (puzzle.publishedAt !== null) await this.puzzles.markReviewed(number, actorId, this.now())
    return { number }
  }

  private async toChange(puzzle: DailyPuzzle, input: ReplaceCardInput): Promise<PuzzleCardChange> {
    if (input.card === 'word') {
      const word = await this.words.findById(input.wordId)
      if (!word) throw new DailyAdminNotFoundError('palavra não encontrada')
      if (!word.active) throw new DailyAdminInvalidError(['a palavra está desativada'])
      return { card: 'word', wordId: word.id }
    }
    if (input.card === 'question') {
      const question = await this.questions.findById(input.questionId)
      if (!question) throw new DailyAdminNotFoundError('pergunta não encontrada')
      if (!question.active) throw new DailyAdminInvalidError(['a pergunta está desativada'])
      return { card: 'question', questionId: question.id }
    }
    const ids = [...new Set(input.eventIds)]
    if (ids.length !== TIMELINE_SIZE) {
      throw new DailyAdminInvalidError([`a Linha do tempo precisa de ${TIMELINE_SIZE} eventos`])
    }
    const found = await this.events.findManyByIds(ids)
    if (found.length !== ids.length) throw new DailyAdminNotFoundError('evento não encontrado')
    if (found.some((e) => !e.active)) {
      throw new DailyAdminInvalidError(['há evento desativado na Linha do tempo'])
    }
    // O mesmo embaralhamento da agenda, por data: nunca já na ordem certa.
    const display = generateTimeline(puzzle.gameDate, found)
    if (!display) {
      throw new DailyAdminInvalidError(['os eventos precisam ter anos distintos'])
    }
    return { card: 'timeline', timelineEventIds: display.map((e) => e.id) }
  }
}
