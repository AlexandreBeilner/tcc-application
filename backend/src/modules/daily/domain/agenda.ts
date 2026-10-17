import type { DailyFact, DailyWord } from './content'
import { addDays, daysBetween } from './gameDay'
import { seededRandom } from './seededRandom'
import { generateTimeline } from './timelineGenerator'

// Planejamento puro de um dia da agenda (DI.1.3): escolhe palavra, fato e Linha do tempo a partir
// dos bancos e do que já está agendado ao redor. Sem I/O; o caso de uso carrega os dados e grava.

export interface AgendaWindows {
  // Uma palavra-resposta não repete dentro desta distância (em dias, para os dois lados).
  wordDays: number
  // O mesmo para o fato do cartão "Neste dia".
  onThisDayDays: number
  // O mesmo para os fatos da Linha do tempo (janela menor: o mesmo evento em ordenações
  // diferentes é aceitável, e janela grande exigiria um banco enorme).
  timelineDays: number
}

export const DEFAULT_WINDOWS: AgendaWindows = {
  wordDays: 365,
  onThisDayDays: 365,
  timelineDays: 14,
}

// O que já está agendado num dia, com o que a regra de variedade precisa saber. Categoria e
// marcador nulos = item que saiu do banco ativo (conta para repetição, não para variedade).
export interface ScheduledDay {
  date: string
  wordId: string
  wordCategory: string | null
  wordScope: 'brasil' | 'fora' | null
  factId: string
  factCategory: string | null
  factScope: 'brasil' | 'fora' | null
  timelineFactIds: string[]
}

export type AgendaWarningCode =
  | 'no_word_available'
  | 'no_fact_available'
  | 'no_timeline_available'
  // Não havia fato do dia e mês exatos: usou o mais próximo. O cartão não pode dizer "hoje".
  | 'on_this_day_not_exact'
  // Faltou conteúdo do Brasil para manter a maioria da semana.
  | 'scope_rule_relaxed'

export interface DayPlan {
  wordId: string
  factId: string
  timelineFactIds: string[]
}

export interface PlanDayInput {
  date: string
  words: readonly DailyWord[]
  facts: readonly DailyFact[]
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

// Distância circular entre dois dias do calendário, ignorando o ano (ano bissexto fixo).
function calendarDistance(eventDate: string, date: string): number {
  const dayOfYear = (value: string) =>
    Math.round(
      (Date.UTC(2000, Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) -
        Date.UTC(2000, 0, 1)) /
        86_400_000,
    )
  const diff = Math.abs(dayOfYear(eventDate) - dayOfYear(date))
  return Math.min(diff, 366 - diff)
}

const decadeOf = (year: number) => Math.floor(year / 10)

export function planDay(input: PlanDayInput): PlanDayResult {
  const { date, words, facts, history } = input
  const windows = input.windows ?? DEFAULT_WINDOWS
  const warnings: AgendaWarningCode[] = []

  const neighbors = history.filter((h) => within(h.date, date, 1) && h.date !== date)
  const lastSix = history.filter((h) => h.date < date && daysBetween(h.date, date) <= 6)

  const wordPool = words
    .filter((w) => w.active)
    .filter(
      (w) => !history.some((h) => h.wordId === w.id && within(h.date, date, windows.wordDays)),
    )
  const word = choose(wordPool, {
    seed: `diario-word:${date}`,
    neighborCategories: new Set(
      neighbors.map((h) => h.wordCategory).filter((c): c is string => c !== null),
    ),
    recentScopes: lastSix.map((h) => h.wordScope),
  })
  if (!word) warnings.push('no_word_available')
  else if (word.relaxed) warnings.push('scope_rule_relaxed')

  // Neste dia: o fato do dia e mês exatos; sem ele, o mais próximo no calendário.
  const factPool = facts
    .filter((f) => f.active)
    .filter(
      (f) => !history.some((h) => h.factId === f.id && within(h.date, date, windows.onThisDayDays)),
    )
  const minDistance = factPool.reduce(
    (min, f) => Math.min(min, calendarDistance(f.eventDate, date)),
    Infinity,
  )
  const nearest = factPool.filter((f) => calendarDistance(f.eventDate, date) === minDistance)
  const fact = choose(nearest, {
    seed: `diario-fact:${date}`,
    neighborCategories: new Set(
      neighbors.map((h) => h.factCategory).filter((c): c is string => c !== null),
    ),
    recentScopes: lastSix.map((h) => h.factScope),
  })
  if (!fact) warnings.push('no_fact_available')
  else {
    if (minDistance > 0) warnings.push('on_this_day_not_exact')
    if (fact.relaxed) warnings.push('scope_rule_relaxed')
  }

  // Linha do tempo: fatos com nome curto, fora da janela e diferentes do fato do dia. Tenta algumas
  // sementes até misturar décadas e categorias; sem isso, fica com a primeira.
  const timelinePool = facts
    .filter((f) => f.active && f.timelineLabel !== null && f.id !== fact?.item.id)
    .filter(
      (f) =>
        !history.some(
          (h) => h.timelineFactIds.includes(f.id) && within(h.date, date, windows.timelineDays),
        ),
    )
    .map((f) => ({ id: f.id, year: Number(f.eventDate.slice(0, 4)), category: f.category }))
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

  if (!word || !fact || !timeline) return { plan: null, warnings }
  return {
    plan: {
      wordId: word.item.id,
      factId: fact.item.id,
      timelineFactIds: timeline.map((e) => e.id),
    },
    warnings,
  }
}

export function windowDates(start: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i))
}
