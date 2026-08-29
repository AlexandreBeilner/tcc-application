// Agrupa as 11 `type` do enum `asset_type` do motor (`.docs/engine/catalog.md`)
// nas mesmas 6 categorias usadas pelas abas da tarefa 6.5 (Tesouro /
// CDB-LCA-LCI / CRI-CRA / Ações / ETFs / FIIs) — reaproveita o mesmo
// agrupamento em vez de inventar um terceiro, pro donut de distribuição da
// tela 2.1 (Portfólio).
export type AssetCategory = 'tesouro' | 'cdbLcaLci' | 'criCra' | 'acao' | 'etf' | 'fii'

export interface CategorySlice {
    category: AssetCategory
    label: string
    value: number
    percentage: number
}

export interface PositionLike {
    type: string
    quantity: number
    averagePrice: number
}
