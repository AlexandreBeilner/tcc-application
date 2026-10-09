// Contas da barra de cobertura do FGC (RC.3.4b). Os limites espelham os fatos
// `fgc-limite-por-cpf` e `fgc-teto-global` de
// `backend/src/modules/lessons/domain/regulatoryFacts.ts`; mudar lá exige mudar aqui.
export const FGC_LIMIT_PER_INSTITUTION = 250_000
export const FGC_GLOBAL_LIMIT = 1_000_000

export interface FgcGroup {
    amount: number
    covered: number
    uncovered: number
}

export interface FgcCoverage {
    groups: FgcGroup[]
    covered: number
    uncovered: number
    cappedByGlobal: boolean
}

// `amounts` são os valores em cada instituição que entrou em liquidação dentro
// da mesma janela de 4 anos. Instituições do mesmo conglomerado contam como uma
// só: somam-se antes de aplicar o limite por conglomerado.
export function fgcCoverage(amounts: number[], sameConglomerate: boolean): FgcCoverage {
    const grouped = sameConglomerate ? [amounts.reduce((sum, value) => sum + value, 0)] : amounts
    const groups = grouped.map((amount) => {
        const covered = Math.min(amount, FGC_LIMIT_PER_INSTITUTION)
        return { amount, covered, uncovered: amount - covered }
    })
    const coveredBeforeCap = groups.reduce((sum, group) => sum + group.covered, 0)
    const covered = Math.min(coveredBeforeCap, FGC_GLOBAL_LIMIT)
    const total = groups.reduce((sum, group) => sum + group.amount, 0)
    return { groups, covered, uncovered: total - covered, cappedByGlobal: coveredBeforeCap > FGC_GLOBAL_LIMIT }
}
