// Agrupa as 11 `type` do enum `asset_type` do motor (`.docs/engine/catalog.md`)
// nas mesmas 6 categorias usadas pelas abas da tarefa 6.5 (Tesouro /
// CDB-LCA-LCI / CRI-CRA / Ações / ETFs / FIIs) — reaproveita o mesmo
// agrupamento em vez de inventar um terceiro, pro donut de distribuição da
// tela 2.1 (Portfólio).
export type AssetCategory = 'tesouro' | 'cdbLcaLci' | 'criCra' | 'acao' | 'etf' | 'fii'

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

export interface CategorySlice {
    category: AssetCategory
    label: string
    value: number
    percentage: number
}

interface PositionLike {
    type: string
    quantity: number
    averagePrice: number
}

// Valor de cada posição = quantidade × preço médio de aquisição (custo),
// não marcação a mercado — `GET /market/me/account` (6.0.3) não devolve
// preço atual por posição, só o motor de catálogo (`GET /market/assets/:id`)
// tem isso, e chamar essa rota uma vez por posição pra um gráfico de
// distribuição é escopo de uma tarefa futura (6.5), não desta.
export function groupPositionsByCategory(positions: PositionLike[], fixedIncomePositions: PositionLike[]): CategorySlice[] {
    const totalsByCategory = new Map<AssetCategory, number>()

    for (const position of [...positions, ...fixedIncomePositions]) {
        const category = CATEGORY_BY_TYPE[position.type]
        if (!category) continue
        const value = position.quantity * position.averagePrice
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
