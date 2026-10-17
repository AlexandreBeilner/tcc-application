// Entidades do Diário como o domínio as enxerga (sem Drizzle). Os campos de gabarito
// (`answer`, `correctIndex`) existem aqui porque o servidor avalia; quem monta a resposta HTTP é
// que nunca os devolve antes da hora (DP3, DI.2.1).

// Brasil, ou fora com efeito no Brasil (seção 3.3). A agenda usa para manter a maioria sobre o Brasil.
export type ContentScope = 'brasil' | 'fora'

export type LearnMoreKind = 'lesson' | 'glossary' | 'guide'

export interface LearnMore {
  kind: LearnMoreKind
  ref: string
}

export interface DailyWord {
  id: string
  stableKey: string
  // Forma normalizada (maiúsculas, sem acento).
  answer: string
  // Como aparece na revelação (`AÇÕES`).
  display: string
  definition: string
  learnMore: LearnMore | null
  category: string
  scope: ContentScope
  active: boolean
}

export interface DailyFact {
  id: string
  stableKey: string
  // YYYY-MM-DD
  eventDate: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  // Nome curto na Linha do tempo; nulo = o fato não entra nela.
  timelineLabel: string | null
  sourceRef: string
  learnMore: LearnMore | null
  category: string
  scope: ContentScope
  reviewedAt: Date | null
  active: boolean
}

export type CardOrigin = 'generated' | 'manual'

export interface DailyPuzzle {
  number: number
  // YYYY-MM-DD
  gameDate: string
  wordId: string
  factId: string
  // Ordem de exibição da Linha do tempo (4 ids de `DailyFact`).
  timelineFactIds: string[]
  wordOrigin: CardOrigin
  factOrigin: CardOrigin
  timelineOrigin: CardOrigin
  reviewedBy: string | null
  reviewedAt: Date | null
  publishedAt: Date | null
}

// Cada `*Correct` nulo = cartão ainda não respondido.
export interface DailyResult {
  userId: string
  puzzleNumber: number
  wordGuesses: string[]
  wordCorrect: boolean | null
  factChoice: number | null
  factCorrect: boolean | null
  timelineOrder: string[] | null
  timelineCorrect: boolean | null
  xpAwarded: number
  startedAt: Date
  completedAt: Date | null
}
