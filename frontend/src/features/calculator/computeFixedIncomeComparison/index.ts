import type { ComparisonProductInput, ComparisonProductResult } from './types'

export type { ComparisonProductInput, ComparisonProductResult } from './types'

const DAYS_PER_YEAR = 365

// Calculadora — modo comparação (tela 6.2, lição 3.3: "CDB 110% CDI
// líquido vs. LCI 90% CDI isento"). Decisão (b) do backlog 6.7: produto
// hipotético digitado pelo usuário (nome + taxa anual + isenção de IR),
// sem `asset_id` real do catálogo — por isso o crescimento é uma
// capitalização composta genérica sobre `daysHeld` dias corridos
// (`(1+i)^(dias/365)`), não a fórmula de deságio nominal por dias úteis
// que o motor usa pra um título real (`fixedincome.PrefixedPrice`,
// `.docs/engine/fixedincome.md`) — aproximação assumida, documentada aqui.
// `marketTaxRate` vem de `GET /market/fixed-income/tax-rate` (mesma
// alíquota regressiva real da legislação, `fixedincome.
// RegressiveIncomeTaxRate`), ignorada quando o produto é isento.
export function computeFixedIncomeComparison(
    product: ComparisonProductInput,
    amount: number,
    daysHeld: number,
    marketTaxRate: number,
): ComparisonProductResult {
    const annualRate = product.annualRatePct / 100
    const grossValue = amount * (1 + annualRate) ** (daysHeld / DAYS_PER_YEAR)
    const taxRate = product.taxExempt ? 0 : marketTaxRate
    const profit = grossValue - amount
    const netValue = amount + profit * (1 - taxRate)

    return { grossValue, netValue, taxRate }
}
