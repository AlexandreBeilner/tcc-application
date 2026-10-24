// Espelha `.docs/backend/retrospectives.md`.
export interface Retrospective {
    // 'AAAA-MM'
    month: string
    lessonsCompleted: number
    achievementsUnlocked: number
    achievementNames: string[]
    level: number
    // Dias do mês (1 a 31) com atividade; os demais foram dias off.
    activeDays: number[]
    daysInMonth: number
    longestStreak: number
    // Rentabilidade percentual do mês (a mesma do ranking); nunca valor em reais (RNF09).
    bestReturnPct: number | null
    duelsPlayed: number
    duelsWon: number
    leaguesActive: number
    // Nada aconteceu no mês: a tela mostra um texto acolhedor.
    empty: boolean
}
