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

// Pergunta de conhecimentos gerais de economia e finanças (cartão `trivia`). Sem data: o banco não
// precisa cobrir o calendário, só o tema e a variedade (seção 3.3).
export interface DailyQuestion {
  id: string
  stableKey: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  sourceRef: string
  learnMore: LearnMore | null
  category: string
  scope: ContentScope
  reviewedAt: Date | null
  active: boolean
}

// Evento datado da Linha do tempo. Só o ano importa para ordenar; `label` é o nome curto mostrado
// ("Plano Real") e `explanation` aparece depois da resposta, com o porquê de o evento importar.
export interface DailyEvent {
  id: string
  stableKey: string
  year: number
  label: string
  explanation: string
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
  questionId: string
  // Ordem de exibição da Linha do tempo (4 ids de `DailyEvent`).
  timelineEventIds: string[]
  wordOrigin: CardOrigin
  questionOrigin: CardOrigin
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
  questionChoice: number | null
  questionCorrect: boolean | null
  timelineOrder: string[] | null
  timelineCorrect: boolean | null
  xpAwarded: number
  startedAt: Date
  completedAt: Date | null
}
