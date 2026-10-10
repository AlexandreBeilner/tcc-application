import type { AssetCategory, CategorySlice, PositionLike } from './types'

export type { AssetCategory, CategorySlice } from './types'

const CATEGORY_BY_TYPE: Record<string, AssetCategory> = {
    tesouro_selic: 'tesouro',
    tesouro_prefixado: 'tesouro',
    tesouro_ipca: 'tesouro',
    cdb: 'cdbLcaLci',
    lca: 'cdbLcaLci',
    lci: 'cdbLcaLci',
    cri: 'criCra',
    cra: 'criCra',
    acao: 'acao',
    etf: 'etf',
    fii: 'fii',
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
    tesouro: 'Tesouro Direto',
    cdbLcaLci: 'CDB / LCA / LCI',
    criCra: 'CRI / CRA',
    acao: 'Ações',
    etf: 'ETFs',
    fii: 'FIIs',
}

// Ordem fixa = ordem da paleta categórica (skill `dataviz`, checks de CVD
// rodados pra esta ordem — ver `index.css`/`DistributionChart.module.css`).
// Nunca reordenar por valor: a cor identifica a categoria, não o tamanho
// da fatia.
export const CATEGORY_ORDER: AssetCategory[] = ['tesouro', 'cdbLcaLci', 'criCra', 'acao', 'etf', 'fii']

// Valor de cada posição = quantidade × preço de mercado (`markPrice`, tarefa
// S.6) quando presente, senão o preço médio de aquisição (renda fixa e
// posição sem cotação), a mesma base dos cards de patrimônio
// (`calculateAccountTotals`, decisão D6 da revisão de trilhas). Posição de
// treino (`isSandbox`) fica fora: o donut mostra só o Mercado Ao Vivo, então a
// soma das fatias bate com o card "Mercado Ao Vivo".
export function groupPositionsByCategory(positions: PositionLike[], fixedIncomePositions: PositionLike[]): CategorySlice[] {
    const totalsByCategory = new Map<AssetCategory, number>()

    for (const position of [...positions, ...fixedIncomePositions]) {
        if (position.isSandbox) continue
        const category = CATEGORY_BY_TYPE[position.type]
        if (!category) continue
        const value = position.quantity * (position.markPrice ?? position.averagePrice)
        totalsByCategory.set(category, (totalsByCategory.get(category) ?? 0) + value)
    }

    const grandTotal = [...totalsByCategory.values()].reduce((sum, value) => sum + value, 0)
    if (grandTotal <= 0) return []

    return CATEGORY_ORDER.filter((category) => (totalsByCategory.get(category) ?? 0) > 0).map((category) => {
        const value = totalsByCategory.get(category) ?? 0
        return {
            category,
            label: CATEGORY_LABELS[category],
            value,
            percentage: value / grandTotal,
        }
    })
}
