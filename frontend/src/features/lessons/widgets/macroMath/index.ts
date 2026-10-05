// Contas dos widgets de juros e inflação das lições (RC.3.4c). Funções puras,
// sem motor nem rede.

// Meta de inflação vigente (fato `meta-inflacao` em `backend/src/modules/
// lessons/domain/regulatoryFacts.ts`: 3,00% com tolerância de 1,5 ponto
// percentual); mudar lá exige mudar aqui.
export const INFLATION_TARGET_PCT = 3
export const INFLATION_TOLERANCE_PP = 1.5

// Reuniões ordinárias do Copom por ano (fato `copom-reunioes`).
export const COPOM_MEETINGS_PER_YEAR = 8

// Rentabilidade real de Fisher: (1 + nominal) / (1 + inflação) - 1, em pontos
// percentuais. Subtrair as duas taxas é só uma aproximação.
export function realReturnPct(nominalPct: number, inflationPct: number): number {
    return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100
}

// Quanto o valor aplicado vira em um ano (nominal) e quanto isso compra em
// dinheiro de hoje (poder de compra), dada a inflação do mesmo ano.
export function oneYearOutcome(amount: number, nominalPct: number, inflationPct: number) {
    const nominal = amount * (1 + nominalPct / 100)
    const inTodaysMoney = nominal / (1 + inflationPct / 100)
    return { nominal, inTodaysMoney }
}

export type InflationBand = 'below' | 'inside' | 'above'

// Onde a inflação medida cai em relação ao intervalo de tolerância da meta.
export function inflationBand(inflationPct: number): InflationBand {
    if (inflationPct < INFLATION_TARGET_PCT - INFLATION_TOLERANCE_PP) return 'below'
    if (inflationPct > INFLATION_TARGET_PCT + INFLATION_TOLERANCE_PP) return 'above'
    return 'inside'
}
