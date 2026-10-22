// Tipos do contrato HTTP do Diário (`.docs/backend/daily.md`) e do estado que o módulo desenha.
// Nada aqui avalia o jogo: cores, acerto e ordem certa vêm sempre do servidor (DP3).

export type LetterState = 'correct' | 'present' | 'absent'
export type LearnMore = { kind: 'lesson' | 'glossary' | 'guide'; ref: string } | null
export type Mode = 'publico' | 'app'

export interface DailyGame {
    number: number
    date: string
    isToday: boolean
    nextGameAt: string
    cards: {
        word: { length: number; maxAttempts: number }
        trivia: { question: string; options: string[] }
    }
}

export type TodayResponse =
    { status: 'off' } | { status: 'scheduled'; startDate: string; startsAt: string } | { status: 'live'; game: DailyGame }

export interface WordReveal {
    answer: string
    definition: string
    learnMore: LearnMore
}

export interface Completion {
    correctCards: number
    xpAwarded: number
    level?: number
    leveledUp?: boolean
    streakMilestone?: number | null
    unlockedAchievements?: { id: string; name: string; description: string }[]
}

export interface GuessResponse {
    letters: LetterState[]
    solved: boolean
    attempt: number
    finished: boolean
    reveal?: WordReveal
    completion?: Completion
}

export interface TriviaResponse {
    correct: boolean
    correctIndex: number
    explanation: string
    sourceRef: string
    learnMore: LearnMore
    completion?: Completion
}

export interface WordProgress {
    guesses: { guess: string; letters: LetterState[] }[]
    finished: boolean
    solved: boolean
    reveal: WordReveal | null
}

export type TriviaProgress =
    | { answered: false }
    | {
          answered: true
          choice: number
          correct: boolean
          correctIndex: number
          explanation: string
          sourceRef: string
          learnMore: LearnMore
      }

/** O que a tela precisa para redesenhar um jogo: o mesmo formato vale para o `localStorage` e para `GET /daily/:n/me`. */
export interface GameProgress {
    number: number
    word: WordProgress
    trivia: TriviaProgress
    /** Só o guardador local preenche (momento em que o último cartão fechou). */
    finishedAt: string | null
    /** Só o guardador local usa: o jogo do dia fechou antes da virada (conta para a sequência local). */
    onTime: boolean
}

export interface DailyStats {
    games: number
    word: { played: number; correct: number; accuracy: number }
    trivia: { played: number; correct: number; accuracy: number }
    wordAttempts: { distribution: Record<string, number>; failed: number }
    currentStreak: number
    longestStreak: number
}
