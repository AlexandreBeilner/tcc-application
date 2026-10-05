// Contas dos widgets da lição de reserva de emergência (RC.4.6). Funções puras.

export type IncomeType = 'stable' | 'variable'

// Faixas de meses de despesas: regra de bolso muito usada em educação
// financeira, não uma norma. O Caderno de Educação Financeira do Banco Central
// manda ter a reserva em aplicação de alta liquidez e baixo risco, mas não fixa
// um número de meses (ver `reserva-emergencia-bcb` em `regulatoryFacts.ts`).
export const RESERVE_MONTHS: Record<IncomeType, { min: number; max: number }> = {
    stable: { min: 3, max: 6 },
    variable: { min: 6, max: 12 },
}

export interface EmergencyFundTarget {
    minMonths: number
    maxMonths: number
    minAmount: number
    maxAmount: number
}

// A meta é sobre o custo de vida essencial mensal, não sobre a renda.
export function emergencyFundTarget(monthlyCost: number, incomeType: IncomeType): EmergencyFundTarget {
    const { min, max } = RESERVE_MONTHS[incomeType]
    return { minMonths: min, maxMonths: max, minAmount: monthlyCost * min, maxAmount: monthlyCost * max }
}

// Meses para juntar `target` aportando `monthly` por mês, sem contar rendimento
// (conta conservadora). `null` quando não há aporte.
export function monthsToReach(target: number, monthly: number): number | null {
    if (monthly <= 0) return null
    return Math.ceil(target / monthly)
}
