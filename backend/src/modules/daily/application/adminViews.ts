import type { CoverageTally } from '../domain/adminCoverage'
import type {
  CardOrigin,
  ContentScope,
  DailyEvent,
  DailyQuestion,
  DailyWord,
} from '../domain/content'
import type { DailyStatus } from '../domain/gameDay'

// Visões do painel (DI.5.1). Diferente das rotas públicas, o painel vê o gabarito: é para revisar.

export interface AdminAgendaDay {
  number: number
  date: string
  reviewed: boolean
  published: boolean
  origins: { word: CardOrigin; question: CardOrigin; timeline: CardOrigin }
  word: { display: string; category: string; scope: ContentScope } | null
  question: { text: string; category: string; scope: ContentScope } | null
  events: { label: string; year: number; category: string; scope: ContentScope }[]
}

export type AdminAlertCode =
  // Dias revisados e consecutivos à frente abaixo de 14.
  | 'low_reviewed_cover'
  // Agendado, mas com menos revisados do que a estreia exige: algo foi editado depois.
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
  reviewedDaysAhead: number
  publishedDaysAhead: number
  minDaysToSchedule: number
  lowCoverThreshold: number
  alerts: AdminAlertCode[]
  days: AdminAgendaDay[]
  coverage: {
    windowDays: number
    word: CoverageTally
    trivia: CoverageTally
    timeline: CoverageTally
  }
  bank: { words: number; questions: number; events: number; acceptedExtra: number }
}

export interface AdminPuzzleView {
  number: number
  date: string
  isTodayOrPast: boolean
  reviewedAt: Date | null
  publishedAt: Date | null
  origins: { word: CardOrigin; question: CardOrigin; timeline: CardOrigin }
  word: DailyWord
  question: DailyQuestion
  // Ordem em que o jogador vê.
  events: DailyEvent[]
  // Ids na ordem certa (por ano), o gabarito da Linha do tempo.
  correctOrder: string[]
  warnings: string[]
}

export interface ContentChangeResult<T> {
  item: T
  // Jogos (hoje e à frente) que usam o item: o painel avisa, desativar não tira o item do jogo.
  affectedPuzzles: number[]
  // Dias não publicados que perderam a revisão por causa da edição.
  clearedReviews: number[]
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
