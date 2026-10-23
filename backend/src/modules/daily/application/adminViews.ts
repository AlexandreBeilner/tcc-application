import type { CoverageTally } from '../domain/adminCoverage'
import type { CardOrigin, ContentScope, DailyQuestion, DailyWord } from '../domain/content'
import type { DailyStatus } from '../domain/gameDay'

// Visões do painel (DI.5.1). Diferente das rotas públicas, o painel vê o gabarito: é para conferir.

export interface AdminAgendaDay {
  number: number
  date: string
  published: boolean
  origins: { word: CardOrigin; question: CardOrigin }
  word: { display: string; category: string; scope: ContentScope } | null
  question: { text: string; category: string; scope: ContentScope } | null
}

export type AdminAlertCode =
  // Dias prontos e consecutivos à frente abaixo de 14.
  | 'low_ready_cover'
  // Agendado, mas com menos dias prontos do que a estreia exige.
  | 'scheduled_below_minimum'
  // No ar e o jogo de hoje não está publicado: o jogador vê "indisponível".
  | 'today_not_published'

export interface AdminOverview {
  status: DailyStatus['status']
  startDate: string | null
  today: string
  // Só enquanto a estreia não chegou a data muda (seção 3.5).
  canChangeStart: boolean
  // Primeiro dia da agenda mostrada: hoje (no ar), a estreia (agendado) ou o primeiro rascunho.
  agendaFrom: string
  readyDaysAhead: number
  publishedDaysAhead: number
  minDaysToSchedule: number
  lowCoverThreshold: number
  alerts: AdminAlertCode[]
  days: AdminAgendaDay[]
  coverage: {
    windowDays: number
    word: CoverageTally
    trivia: CoverageTally
  }
  bank: { words: number; questions: number; acceptedExtra: number }
}

export interface AdminPuzzleView {
  number: number
  date: string
  isTodayOrPast: boolean
  publishedAt: Date | null
  origins: { word: CardOrigin; question: CardOrigin }
  word: DailyWord
  question: DailyQuestion
  warnings: string[]
}

export interface ContentChangeResult<T> {
  item: T
  // Jogos (hoje e à frente) que usam o item: o painel avisa, desativar não tira o item do jogo.
  affectedPuzzles: number[]
}

export interface StartDateResult {
  startDate: string | null
  status: DailyStatus['status']
  published: number[]
}

export interface DraftResult {
  startDate: string
  created: number
  warnings: { date: string; code: string }[]
}
