import type { PositionReturn } from '../positionReturns'

export type PositionFilter = 'todas' | 'acoes' | 'fiis' | 'etfs' | 'rendaFixa'
export type PositionSort = 'valor' | 'resultado' | 'ticker'

export const POSITION_FILTERS: { key: PositionFilter; label: string }[] = [
    { key: 'todas', label: 'Todos' },
    { key: 'acoes', label: 'Ações' },
    { key: 'fiis', label: 'FIIs' },
    { key: 'etfs', label: 'ETFs' },
    { key: 'rendaFixa', label: 'Renda fixa' },
]

export const POSITION_SORTS: { key: PositionSort; label: string }[] = [
    { key: 'valor', label: 'Valor atual' },
    { key: 'resultado', label: 'Resultado %' },
    { key: 'ticker', label: 'Ticker' },
]

export function parsePositionFilter(value: string | null): PositionFilter {
    return POSITION_FILTERS.some((filter) => filter.key === value) ? (value as PositionFilter) : 'todas'
}

export function parsePositionSort(value: string | null): PositionSort {
    return POSITION_SORTS.some((sort) => sort.key === value) ? (value as PositionSort) : 'valor'
}

function matchesFilter(row: PositionReturn, filter: PositionFilter): boolean {
    if (filter === 'todas') return true
    if (filter === 'rendaFixa') return row.isFixedIncome
    return row.category === { acoes: 'acao', fiis: 'fii', etfs: 'etf' }[filter]
}

// Resultado % nulo (custo zero) vai para o fim, nunca para o topo.
function compare(sort: PositionSort): (a: PositionReturn, b: PositionReturn) => number {
    if (sort === 'ticker') return (a, b) => a.ticker.localeCompare(b.ticker, 'pt-BR')
    if (sort === 'resultado') {
        return (a, b) => (b.resultRatio ?? Number.NEGATIVE_INFINITY) - (a.resultRatio ?? Number.NEGATIVE_INFINITY)
    }
    return (a, b) => b.currentValue - a.currentValue
}

export function filterAndSortPositions(rows: PositionReturn[], filter: PositionFilter, sort: PositionSort): PositionReturn[] {
    return rows.filter((row) => matchesFilter(row, filter)).sort(compare(sort))
}

// Rota de detalhe do ativo: renda fixa tem tela própria, o resto vai para a página do ativo.
export function positionDetailPath(row: Pick<PositionReturn, 'assetId' | 'isFixedIncome'>): string {
    return row.isFixedIncome ? `/mercado/renda-fixa/${row.assetId}` : `/mercado/ativos/${row.assetId}`
}
