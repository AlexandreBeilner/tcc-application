export type CatalogClass = 'acao' | 'fii' | 'etf' | 'renda_fixa'

export interface CatalogFilters {
    klass: CatalogClass | 'all'
    query: string
}

// Texto digitado de cada campo editável; vazio significa "não mexer" só pra campos que o
// ativo nem permite editar (os que permite começam preenchidos com o valor atual).
export interface CatalogDraft {
    name: string
    base_growth_pct: string
    quality_multiplier: string
    methodology_summary: string
}
