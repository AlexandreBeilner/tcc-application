// Espelha `.docs/backend/retrospectives.md`.
export interface RetrospectivePremium {
    // Dias do mês (1 a 31) com atividade; os demais foram dias off.
    activeDays: number[]
    daysInMonth: number
    longestStreak: number
    // Rentabilidade percentual do mês (a mesma do ranking); nunca valor em reais (RNF09).
    bestReturnPct: number | null
    duelsPlayed: number
    duelsWon: number
    leaguesActive: number
}

export interface Retrospective {
    // 'AAAA-MM'
    month: string
    // Conteúdo completo liberado (PRO ativo agora). Quando `false`, `premium` é `null`.
    full: boolean
    lessonsCompleted: number
    achievementsUnlocked: number
    achievementNames: string[]
    level: number
    premium: RetrospectivePremium | null
    // Nada aconteceu no mês: a tela mostra um texto acolhedor.
    empty: boolean
}
