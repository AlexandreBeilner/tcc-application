import { randomUUID } from 'node:crypto'
import type { DailyCategory } from '../../../content/categories'
import { validateContent, wordStableKey, type ContentBundle } from '../../../content/dailyContent'
import type { QuestionSeed } from '../../../content/questions'
import type { ContentScope, DailyQuestion, DailyWord, LearnMore } from '../../../domain/content'
import {
  DailyAdminConflictError,
  DailyAdminInvalidError,
  DailyAdminNotFoundError,
} from '../../../domain/errors'
import { MAX_WORD_LENGTH, MIN_WORD_LENGTH, normalizeWord } from '../../../domain/wordGuess'
import type { ContentChangeResult } from '../../adminViews'
import type { AcceptedWordRepository } from '../../ports/acceptedWordRepository'
import type { DailyPuzzleRepository, PuzzleItemKind } from '../../ports/dailyPuzzleRepository'
import type { DailyQuestionRepository } from '../../ports/dailyQuestionRepository'
import type { DailyWordRepository } from '../../ports/dailyWordRepository'

const OPTIONS_MIN = 2
const OPTIONS_MAX = 6

// O que editar um item faz com os jogos que o usam: avisa quais são (desativar não tira o item de
// um jogo já montado) e pede confirmação se algum está publicado.
class ContentImpact {
  constructor(private readonly puzzles: DailyPuzzleRepository) {}

  async check(
    kind: PuzzleItemKind,
    itemId: string,
    needsConfirmation: boolean,
    confirmed: boolean,
  ) {
    const using = await this.puzzles.listUsing(kind, itemId)
    const published = using.filter((p) => p.publishedAt !== null)
    if (needsConfirmation && published.length > 0 && !confirmed) {
      throw new DailyAdminConflictError(
        'confirmation_required',
        `o item está em jogo já publicado (${published.map((p) => `#${p.number}`).join(', ')}); confirme para editar`,
      )
    }
    return using
  }
}

// O corpo HTTP manda `undefined` nos campos que não vieram; sem tirá-los o merge apagaria o valor atual.
function present<T extends object>(patch: T): T {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as T
}

function bundle(parts: Partial<ContentBundle>): ContentBundle {
  return { words: [], questions: [], ...parts }
}

function ensureValid(errors: string[]): void {
  if (errors.length > 0) throw new DailyAdminInvalidError(errors)
}

// ---------- Palavras ----------

export interface WordInput {
  display: string
  definition: string
  category: string
  scope: ContentScope
  learnMore: LearnMore | null
}

export class ListAdminWordsUseCase {
  constructor(private readonly words: DailyWordRepository) {}

  execute(): Promise<DailyWord[]> {
    return this.words.listAll()
  }
}

export class CreateAdminWordUseCase {
  constructor(
    private readonly words: DailyWordRepository,
    private readonly accepted: AcceptedWordRepository,
  ) {}

  async execute(input: WordInput): Promise<DailyWord> {
    const answer = normalizeWord(input.display)
    const isAccepted = await this.accepted.isAccepted(answer)
    ensureValid(
      validateContent(
        bundle({ words: [{ ...input, category: input.category as DailyCategory }] }),
        new Set(isAccepted ? [answer] : []),
      ),
    )
    if ((await this.words.listAll()).some((w) => w.answer === answer)) {
      throw new DailyAdminConflictError('duplicate', `a palavra ${answer} já existe`)
    }
    return this.words.create({
      stableKey: wordStableKey({ ...input, category: input.category as DailyCategory }),
      answer,
      display: input.display,
      definition: input.definition,
      learnMore: input.learnMore,
      category: input.category,
      scope: input.scope,
      active: true,
    })
  }
}

export type WordPatch = Partial<WordInput & { active: boolean }>

export class UpdateAdminWordUseCase {
  private readonly impact: ContentImpact

  constructor(
    private readonly words: DailyWordRepository,
    private readonly accepted: AcceptedWordRepository,
    puzzles: DailyPuzzleRepository,
  ) {
    this.impact = new ContentImpact(puzzles)
  }

  async execute(
    actorId: string,
    id: string,
    rawPatch: WordPatch,
    confirmPublished: boolean,
  ): Promise<ContentChangeResult<DailyWord> & { changedFields: string[] }> {
    const patch = present(rawPatch)
    const current = await this.words.findById(id)
    if (!current) throw new DailyAdminNotFoundError('palavra não encontrada')
    const merged = { ...current, ...patch }
    // A resposta é a identidade da palavra nos jogos já jogados: o texto mostrado pode mudar
    // (acento, caixa), a palavra não.
    if (normalizeWord(merged.display) !== current.answer) {
      throw new DailyAdminInvalidError(['o texto mostrado precisa continuar sendo a mesma palavra'])
    }
    ensureValid(
      validateContent(
        bundle({ words: [{ ...merged, category: merged.category as DailyCategory }] }),
        new Set((await this.accepted.isAccepted(current.answer)) ? [current.answer] : []),
      ),
    )
    const changedFields = (Object.keys(patch) as (keyof WordPatch)[]).filter(
      (key) => JSON.stringify(patch[key]) !== JSON.stringify(current[key]),
    )
    const shownChanged = changedFields.some((k) =>
      ['display', 'definition', 'learnMore'].includes(k),
    )
    const using = await this.impact.check('word', id, shownChanged, confirmPublished)
    const item = (await this.words.update(id, patch, actorId)) as DailyWord
    return { item, affectedPuzzles: using.map((p) => p.number), changedFields }
  }
}

// ---------- Palavras aceitas (lista extra) ----------

export class ListAcceptedExtraUseCase {
  constructor(private readonly accepted: AcceptedWordRepository) {}

  execute(): Promise<string[]> {
    return this.accepted.listExtra()
  }
}

function checkAcceptedForm(word: string): string {
  const normalized = normalizeWord(word.trim())
  if (
    !/^[A-Z]+$/.test(normalized) ||
    normalized.length < MIN_WORD_LENGTH ||
    normalized.length > MAX_WORD_LENGTH
  ) {
    throw new DailyAdminInvalidError([
      `a palavra precisa ter de ${MIN_WORD_LENGTH} a ${MAX_WORD_LENGTH} letras`,
    ])
  }
  return normalized
}

export class AddAcceptedWordUseCase {
  constructor(private readonly accepted: AcceptedWordRepository) {}

  async execute(word: string): Promise<{ word: string }> {
    const normalized = checkAcceptedForm(word)
    if ((await this.accepted.addMany([normalized], 'extra')) === 0) {
      throw new DailyAdminConflictError('duplicate', `${normalized} já é aceita como palpite`)
    }
    return { word: normalized }
  }
}

export class RemoveAcceptedWordUseCase {
  constructor(
    private readonly accepted: AcceptedWordRepository,
    private readonly words: DailyWordRepository,
  ) {}

  async execute(word: string): Promise<{ word: string }> {
    const normalized = checkAcceptedForm(word)
    // Palavra-resposta precisa continuar aceita: o jogador deve poder digitar a resposta.
    if ((await this.words.listAll()).some((w) => w.answer === normalized)) {
      throw new DailyAdminConflictError(
        'word_in_use',
        `${normalized} é palavra-resposta e precisa continuar na lista aceita`,
      )
    }
    if (!(await this.accepted.removeExtra(normalized))) {
      throw new DailyAdminNotFoundError('a palavra não está na lista extra')
    }
    return { word: normalized }
  }
}

// ---------- Perguntas ----------

export interface QuestionInput {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  sourceRef: string
  learnMore: LearnMore | null
  category: string
  scope: ContentScope
}

function questionSeed(key: string, q: QuestionInput): QuestionSeed {
  return {
    key,
    question: q.question,
    options: q.options as QuestionSeed['options'],
    correctIndex: q.correctIndex as QuestionSeed['correctIndex'],
    explanation: q.explanation,
    source: q.sourceRef,
    category: q.category as DailyCategory,
    scope: q.scope,
  }
}

function questionProblems(key: string, q: QuestionInput): string[] {
  const errors = validateContent(bundle({ questions: [questionSeed(key, q)] }), new Set())
  if (q.options.length < OPTIONS_MIN || q.options.length > OPTIONS_MAX) {
    errors.push(`a pergunta precisa de ${OPTIONS_MIN} a ${OPTIONS_MAX} alternativas`)
  }
  if (q.question.trim().length === 0) errors.push('a pergunta está vazia')
  return errors
}

export class ListAdminQuestionsUseCase {
  constructor(private readonly questions: DailyQuestionRepository) {}

  execute(): Promise<DailyQuestion[]> {
    return this.questions.listAll()
  }
}

export class CreateAdminQuestionUseCase {
  constructor(private readonly questions: DailyQuestionRepository) {}

  async execute(input: QuestionInput): Promise<DailyQuestion> {
    const key = `m-${randomUUID().slice(0, 8)}`
    ensureValid(questionProblems(key, input))
    return this.questions.create({
      ...input,
      stableKey: `q:${key}`,
      reviewedAt: null,
      active: true,
    })
  }
}

export type QuestionPatch = Partial<QuestionInput & { active: boolean }>

const QUESTION_SHOWN_FIELDS = [
  'question',
  'options',
  'correctIndex',
  'explanation',
  'sourceRef',
  'learnMore',
]

export class UpdateAdminQuestionUseCase {
  private readonly impact: ContentImpact

  constructor(
    private readonly questions: DailyQuestionRepository,
    puzzles: DailyPuzzleRepository,
  ) {
    this.impact = new ContentImpact(puzzles)
  }

  async execute(
    actorId: string,
    id: string,
    rawPatch: QuestionPatch,
    confirmPublished: boolean,
  ): Promise<ContentChangeResult<DailyQuestion> & { changedFields: string[] }> {
    const patch = present(rawPatch)
    const current = await this.questions.findById(id)
    if (!current) throw new DailyAdminNotFoundError('pergunta não encontrada')
    const merged: DailyQuestion = { ...current, ...patch }
    ensureValid(questionProblems(current.stableKey, merged))
    const changedFields = (Object.keys(patch) as (keyof QuestionPatch)[]).filter(
      (key) => JSON.stringify(patch[key]) !== JSON.stringify(current[key]),
    )
    const shownChanged = changedFields.some((k) => QUESTION_SHOWN_FIELDS.includes(k))
    const using = await this.impact.check('question', id, shownChanged, confirmPublished)
    const item = (await this.questions.update(id, patch, actorId)) as DailyQuestion
    return { item, affectedPuzzles: using.map((p) => p.number), changedFields }
  }
}
