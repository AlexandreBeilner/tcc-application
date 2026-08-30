export type InterestMode = 'simple' | 'compound'
export type RateUnit = 'month' | 'year'
export type PeriodUnit = 'months' | 'years'

export interface GrowthProjectionInput {
    initialCapital: number
    monthlyContribution: number
    // Taxa em pontos percentuais (ex: 12 = 12%), na unidade de `rateUnit` —
    // mesma convenção de `fixed_income.interest_rate`
    // (`formatRatePercent`, `features/market/format`), não uma razão 0–1.
    // Tarefa 6.7.1: toggle "% a.a."/"% a.m." pra desfazer a ambiguidade de
    // misturar taxa anual com período mensal.
    ratePct: number
    rateUnit: RateUnit
    // Duração total em meses — sempre resolvida pra meses antes de chegar
    // aqui (ver `resolvePeriodInMonths`), independente da unidade que o
    // usuário escolheu digitar (meses ou anos).
    months: number
    mode: InterestMode
}

export interface GrowthProjectionPoint {
    month: number
    // Juros ganho **naquele mês específico** (não acumulado) — mês 0 é
    // sempre 0 (ainda não passou nenhum mês). Sustenta a tabela mês a mês
    // da tela 6.1 (tarefa 6.7.3); o acumulado (`total - invested`) é
    // derivado, não precisa de campo próprio.
    interest: number
    invested: number
    total: number
}

export interface GrowthProjectionResult {
    points: GrowthProjectionPoint[]
    totalInvested: number
    totalValue: number
    totalInterest: number
}
