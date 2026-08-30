import type { GrowthProjectionInput, GrowthProjectionResult } from './types'

export type { InterestMode, GrowthProjectionInput, GrowthProjectionPoint, GrowthProjectionResult } from './types'

const MONTHS_PER_YEAR = 12

// Calculadora — modo simples (tela 6.1, wireframe original Fig. 7): função
// pura, client-side/stateless (backlog 6.7 — nenhum dado persistido, sem
// consumidor de backend). "Composto" reinveste o rendimento (juros incide
// sobre `total`, saldo acumulado); "simples" nunca reinveste (juros incide
// só sobre `invested`, o capital efetivamente aportado até aquele mês) —
// contraste didático clássico entre os dois regimes, mesmo com aporte
// mensal recorrente nos dois. A taxa mensal (`annualRate/12`, nominal
// proporcional) é a **mesma** nos dois modos de propósito — isola a única
// variável que a tela quer ensinar (reinvestir ou não o rendimento), sem
// misturar com a diferença de convenção simples-vs-equivalente-composta.
export function computeGrowthProjection(input: GrowthProjectionInput): GrowthProjectionResult {
    const { initialCapital, monthlyContribution, annualRatePct, months, mode } = input
    const monthlyRate = annualRatePct / 100 / MONTHS_PER_YEAR

    let invested = initialCapital
    let total = initialCapital
    const points = [{ month: 0, invested, total }]

    for (let month = 1; month <= months; month += 1) {
        const interestBase = mode === 'compound' ? total : invested
        total += interestBase * monthlyRate + monthlyContribution
        invested += monthlyContribution
        points.push({ month, invested, total })
    }

    return {
        points,
        totalInvested: invested,
        totalValue: total,
        totalInterest: total - invested,
    }
}
