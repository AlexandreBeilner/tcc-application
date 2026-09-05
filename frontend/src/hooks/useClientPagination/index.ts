import { useState } from 'react'

export interface ClientPagination<T> {
    page: number
    totalPages: number
    pageItems: T[]
    setPage: (page: number) => void
    resetPage: () => void
}

// Paginação inteiramente client-side sobre uma lista já carregada — extraído
// do padrão duplicado em `pages/EquityList`/`pages/FixedIncomeList` (achado
// de revisão da 6.9.9). Clampa `page` pro total disponível, senão trocar de
// aba/filtro pra uma lista menor deixaria a página presa além do fim.
export function useClientPagination<T>(items: T[], pageSize: number): ClientPagination<T> {
    const [page, setPage] = useState(1)
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    const currentPage = Math.min(page, totalPages)
    const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    return {
        page: currentPage,
        totalPages,
        pageItems,
        setPage,
        resetPage: () => setPage(1),
    }
}
