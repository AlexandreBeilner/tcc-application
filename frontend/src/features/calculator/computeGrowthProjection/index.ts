import type { GrowthProjectionInput, GrowthProjectionResult, InterestMode, PeriodUnit, RateUnit } from './types'

export type { InterestMode, RateUnit, PeriodUnit, GrowthProjectionInput, GrowthProjectionPoint, GrowthProjectionResult } from './types'

const MONTHS_PER_YEAR = 12

// Tarefa 6.7.1: converte a taxa digitada (em `rateUnit`) pra taxa mensal
// efetiva usada no laço mês a mês. Se o usuário já digitou em "% a.m.",
// não há conversão nenhuma pra fazer, nos dois modos — é a taxa do
// período, ponto. Se digitou em "% a.a.":
// - "composto" precisa da taxa mensal **equivalente** (juros sobre juros),
//   `(1+i)^(1/12)-1` — nunca `i/12`, que é a taxa **nominal** proporcional
//   e SUPERESTIMA o composto (1%a.m. nominal de 12%a.a. capitalizado 12x
//   rende ~12,68% efetivo no ano, não 12%). Bug real encontrado nesta
//   sessão: a versão anterior usava `i/12` nos dois modos "pra isolar a
//   variável reinvestir/não-reinvestir" — decisão errada, criava um
//   segundo cálculo (conversão de taxa) diferente do que qualquer
//   calculadora de juros compostos de mercado faz, daí o valor composto
//   sempre viesse um pouco acima do esperado.
// - "simples" usa `i/12` mesmo — juros simples não tem "taxa equivalente",
//   é proporcional por definição (não compõe).
export function resolveMonthlyRate(ratePct: number, rateUnit: RateUnit, mode: InterestMode): number {
    const rate = ratePct / 100
    if (rateUnit === 'month') return rate
    return mode === 'compound' ? (1 + rate) ** (1 / MONTHS_PER_YEAR) - 1 : rate / MONTHS_PER_YEAR
}

// Tarefa 6.7.1: resolve o período digitado (em `unit`) pro total de meses
// que o laço da projeção usa — sempre um inteiro (mês é o menor passo do
// modelo), arredondado pro mais próximo mesmo quando o usuário digita um
// valor fracionário (ex: 1,5 ano = 18 meses exatos; 2,3 anos arredonda pra
// 28 meses).
export function resolvePeriodInMonths(value: number, unit: PeriodUnit): number {
    return Math.round(unit === 'years' ? value * MONTHS_PER_YEAR : value)
}

// Calculadora — modo simples (tela 6.1, wireframe original Fig. 7): função
// pura, client-side/stateless (backlog 6.7 — nenhum dado persistido, sem
// consumidor de backend). "Composto" reinveste o rendimento (juros incide
// sobre `total`, saldo acumulado); "simples" nunca reinveste (juros incide
// só sobre `invested`, o capital efetivamente aportado até aquele mês) —
// contraste didático clássico entre os dois regimes, mesmo com aporte
// mensal recorrente nos dois.
export function computeGrowthProjection(input: GrowthProjectionInput): GrowthProjectionResult {
    const { initialCapital, monthlyContribution, ratePct, rateUnit, months, mode } = input
    const monthlyRate = resolveMonthlyRate(ratePct, rateUnit, mode)

    let invested = initialCapital
    let total = initialCapital
    const points = [{ month: 0, interest: 0, invested, total }]

    for (let month = 1; month <= months; month += 1) {
        const interestBase = mode === 'compound' ? total : invested
        const interest = interestBase * monthlyRate
        total += interest + monthlyContribution
        invested += monthlyContribution
        points.push({ month, interest, invested, total })
    }

    return {
        points,
        totalInvested: invested,
        totalValue: total,
        totalInterest: total - invested,
    }
}
