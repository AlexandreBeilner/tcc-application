// Espelha `.docs/backend/ranking.md` (`GET /ranking`).
export type RankingWindow = 'week' | 'month'
export type RankingScope = 'global' | 'friends'
// 6.8.3 — critério de ordenação. `level` ignora janela por completo
// (nível é cumulativo desde sempre).
export type RankingCriterion = 'overall' | 'fixedIncome' | 'variableIncome' | 'level'

export interface RankingEntry {
    userId: string
    username: string
    level: number
    xp: number
    // Pontos percentuais (já multiplicado por 100 pelo backend,
    // `domain/profitability.ts`) — mesma convenção de `daily_change_pct`
    // do motor, formatar com `formatSignedPercent` (`features/market/format`),
    // nunca com `formatPercentage` (`features/portfolio/format`, que espera
    // uma razão 0–1). `null` quando `criterion === 'level'` — esse
    // critério não calcula rentabilidade nenhuma.
    profitabilityPct: number | null
}

export interface GetRankingParams {
    // Obrigatório exceto com `criterion === 'level'`.
    window?: RankingWindow
    scope: RankingScope
    criterion: RankingCriterion
    page: number
}

export interface RankingResult {
    window: RankingWindow | null
    scope: RankingScope
    criterion: RankingCriterion
    entries: RankingEntry[]
    requestingUserPosition: number | null
    page: number
    pageSize: number
    totalEntries: number
    totalPages: number
}
