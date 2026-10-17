import type { DailyEvent, DailyQuestion, DailyWord } from './content'
import { addDays, daysBetween } from './gameDay'
import { seededRandom } from './seededRandom'
import { generateTimeline } from './timelineGenerator'

// Planejamento puro de um dia da agenda (DI.1.3): escolhe palavra, pergunta e Linha do tempo a partir
// dos bancos e do que já está agendado ao redor. Sem I/O; o caso de uso carrega os dados e grava.

export interface AgendaWindows {
  // Uma palavra-resposta não repete dentro desta distância (em dias, para os dois lados).
  wordDays: number
  // O mesmo para a pergunta do cartão `trivia`.
  questionDays: number
  // O mesmo para os fatos da Linha do tempo (janela menor: o mesmo evento em ordenações
  // diferentes é aceitável, e janela grande exigiria um banco enorme).
  timelineDays: number
}

export const DEFAULT_WINDOWS: AgendaWindows = {
  wordDays: 365,
  questionDays: 365,
  timelineDays: 14,
}

// O que já está agendado num dia, com o que a regra de variedade precisa saber. Categoria e
// marcador nulos = item que saiu do banco ativo (conta para repetição, não para variedade).
export interface ScheduledDay {
  date: string
  wordId: string
  wordCategory: string | null
  wordScope: 'brasil' | 'fora' | null
  questionId: string
  questionCategory: string | null
  questionScope: 'brasil' | 'fora' | null
  timelineEventIds: string[]
}

export type AgendaWarningCode =
  | 'no_word_available'
  | 'no_question_available'
  | 'no_timeline_available'
  // Faltou conteúdo do Brasil para manter a maioria da semana.
  | 'scope_rule_relaxed'

export interface DayPlan {
  wordId: string
  questionId: string
  timelineEventIds: string[]
}

export interface PlanDayInput {
  date: string
  words: readonly DailyWord[]
  questions: readonly DailyQuestion[]
  events: readonly DailyEvent[]
  history: readonly ScheduledDay[]
  windows?: AgendaWindows
}

export interface PlanDayResult {
  plan: DayPlan | null
  warnings: AgendaWarningCode[]
}

// Em qualquer 7 dias seguidos, no máximo 3 itens "fora" por cartão (maioria sobre o Brasil, 3.3).
const MAX_FORA_IN_LAST_SIX = 2

interface Pickable {
  id: string
  category: string
  scope: 'brasil' | 'fora'
}

function within(a: string, b: string, days: number): boolean {
  return Math.abs(daysBetween(a, b)) <= days
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

// Aplica a regra de variedade e sorteia de forma determinística. A regra do Brasil é dura enquanto
// houver candidato do Brasil; a de categoria vizinha é só preferência.
function choose<T extends Pickable>(
  candidates: readonly T[],
  context: {
    seed: string
    neighborCategories: Set<string>
    recentScopes: ('brasil' | 'fora' | null)[]
  },
): { item: T; relaxed: boolean } | null {
  if (candidates.length === 0) return null
  let pool = byId(candidates)
  let relaxed = false

  const foraRecent = context.recentScopes.filter((s) => s === 'fora').length
  if (foraRecent > MAX_FORA_IN_LAST_SIX) {
    const brasil = pool.filter((c) => c.scope === 'brasil')
    if (brasil.length > 0) pool = brasil
    else relaxed = true
  }

  const different = pool.filter((c) => !context.neighborCategories.has(c.category))
  if (different.length > 0) pool = different

  return { item: pool[Math.floor(seededRandom(context.seed)() * pool.length)], relaxed }
}

const decadeOf = (year: number) => Math.floor(year / 10)

export function planDay(input: PlanDayInput): PlanDayResult {
  const { date, words, questions, events, history } = input
  const windows = input.windows ?? DEFAULT_WINDOWS
  const warnings: AgendaWarningCode[] = []

  const neighbors = history.filter((h) => within(h.date, date, 1) && h.date !== date)
  const lastSix = history.filter((h) => h.date < date && daysBetween(h.date, date) <= 6)
  const categoriesOf = (pick: (h: ScheduledDay) => string | null) =>
    new Set(neighbors.map(pick).filter((c): c is string => c !== null))

  const wordPool = words
    .filter((w) => w.active)
    .filter(
      (w) => !history.some((h) => h.wordId === w.id && within(h.date, date, windows.wordDays)),
    )
  const word = choose(wordPool, {
    seed: `diario-word:${date}`,
    neighborCategories: categoriesOf((h) => h.wordCategory),
    recentScopes: lastSix.map((h) => h.wordScope),
  })
  if (!word) warnings.push('no_word_available')
  else if (word.relaxed) warnings.push('scope_rule_relaxed')

  const questionPool = questions
    .filter((q) => q.active)
    .filter(
      (q) =>
        !history.some((h) => h.questionId === q.id && within(h.date, date, windows.questionDays)),
    )
  const question = choose(questionPool, {
    seed: `diario-question:${date}`,
    neighborCategories: categoriesOf((h) => h.questionCategory),
    recentScopes: lastSix.map((h) => h.questionScope),
  })
  if (!question) warnings.push('no_question_available')
  else if (question.relaxed) warnings.push('scope_rule_relaxed')

  // Linha do tempo: eventos ativos fora da janela. Tenta algumas sementes até misturar décadas e
  // categorias; sem isso, fica com a primeira.
  const timelinePool = events
    .filter((e) => e.active)
    .filter(
      (e) =>
        !history.some(
          (h) => h.timelineEventIds.includes(e.id) && within(h.date, date, windows.timelineDays),
        ),
    )
  let timeline: typeof timelinePool | null = null
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = generateTimeline(`${date}#${attempt}`, timelinePool)
    if (!candidate) break
    timeline ??= candidate
    const decades = new Set(candidate.map((e) => decadeOf(e.year))).size
    const categories = new Set(candidate.map((e) => e.category)).size
    if (decades >= 3 && categories >= 2) {
      timeline = candidate
      break
    }
  }
  if (!timeline) warnings.push('no_timeline_available')

  if (!word || !question || !timeline) return { plan: null, warnings }
  return {
    plan: {
      wordId: word.item.id,
      questionId: question.item.id,
      timelineEventIds: timeline.map((e) => e.id),
    },
    warnings,
  }
}

export function windowDates(start: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i))
}
