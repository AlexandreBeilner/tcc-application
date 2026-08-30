export type InterestMode = 'simple' | 'compound'

export interface GrowthProjectionInput {
    initialCapital: number
    monthlyContribution: number
    // Taxa anual em pontos percentuais (ex: 12 = 12% a.a.) — mesma
    // convenção de `fixed_income.interest_rate` (`formatRatePercent`,
    // `features/market/format`), não uma razão 0–1.
    annualRatePct: number
    months: number
    mode: InterestMode
}

export interface GrowthProjectionPoint {
    month: number
    invested: number
    total: number
}

export interface GrowthProjectionResult {
    points: GrowthProjectionPoint[]
    totalInvested: number
    totalValue: number
    totalInterest: number
}
