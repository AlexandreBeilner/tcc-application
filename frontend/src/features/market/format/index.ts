const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// `daily_change_pct`/`realized_return_pct`/`vs_contracted_rate` já chegam
// multiplicados por 100 do motor (`.docs/engine/catalog.md`) — diferente de
// `formatPercentage` (`features/portfolio/format`), que espera uma razão
// 0–1 (roe/margens/dividend_yield/tax_rate). Formatar os dois com a mesma
// função esconderia esse fator 100 de diferença, por isso ganham a própria
// função aqui, com sinal explícito (convenção "home broker" de sempre
// mostrar +/− numa variação).
export function formatSignedPercent(alreadyPercentValue: number): string {
    const sign = alreadyPercentValue > 0 ? '+' : alreadyPercentValue < 0 ? '−' : ''
    return `${sign}${decimalFormatter.format(Math.abs(alreadyPercentValue))}%`
}

// P/L, P/VP, ROE em número absoluto (não indicadores de %) — 1 casa
// decimal, mesmo padrão de exibição do mockup vivo (identidade-visual-
// padroes.md §0).
export function formatDecimal(value: number): string {
    return decimalFormatter.format(value)
}

// `fixed_income.interest_rate` (`GET /market/assets/:id`) é a taxa anual
// já em pontos percentuais (ex: `11.75` = 11,75% a.a.) — confirmado em
// `fixedincomeexecution.Purchase` (`ctx.AnnualRatePct / 100` antes de virar
// razão pro motor). Escala diferente de `average_rate` (posição, já vem
// como razão 0–1) e de `roe`/`dividend_yield`/`tax_rate` (`formatPercentage`,
// `features/portfolio/format`) — motivo de ganhar a própria função, sem
// multiplicar por 100 de novo.
export function formatRatePercent(alreadyPercentValue: number): string {
    return `${decimalFormatter.format(alreadyPercentValue)}%`
}
