export interface ComparisonProductInput {
    name: string
    // Taxa anual em pontos percentuais (ex: 11 = "110% do CDI" já
    // convertido pelo usuário pra uma taxa nominal — a Calculadora não
    // conhece CDI/Selic, só o número final, decisão (b) do backlog 6.7).
    annualRatePct: number
    taxExempt: boolean
}

export interface ComparisonProductResult {
    grossValue: number
    netValue: number
    taxRate: number
}
