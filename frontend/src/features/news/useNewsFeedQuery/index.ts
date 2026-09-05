import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listNews } from '../../../services/news'
import type { NewsEvent } from '../../../services/news'

// Mesmo default de paginação do motor (engine/internal/infra/httpserver/
// macroevents.go, defaultMacroEventListLimit) — tarefa 6.9.9: trocou
// "Carregar mais" (useInfiniteQuery, decisão original da 6.6.1) por
// paginação numerada (`Pagination`, mesmo padrão de Amigos/Solicitações/
// Classificação), a pedido do autor revendo a escolha da época. `page`
// vira `offset = (page - 1) * NEWS_FEED_PAGE_SIZE` aqui — o contrato HTTP
// de `GET /news` continua limit/offset (`.docs/backend/news.md`), só o
// motor passou a devolver `total_entries` (tarefa 6.9.9) pra sustentar
// "Página X de Y".
export const NEWS_FEED_PAGE_SIZE = 20

export const NEWS_FEED_QUERY_KEY = ['news', 'feed'] as const

export interface NewsFeedPage {
    events: NewsEvent[]
    page: number
    pageSize: number
    totalEntries: number
    totalPages: number
}

// Query própria do Feed (5.1), separada de `useNewsQuery` (shell/badge) —
// o badge só precisa da primeira página pra saber se surgiu algo novo,
// não acompanha a paginação da tela.
export function useNewsFeedQuery(page: number): UseQueryResult<NewsFeedPage> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...NEWS_FEED_QUERY_KEY, page] as const,
        queryFn: async () => {
            const offset = (page - 1) * NEWS_FEED_PAGE_SIZE
            const result = await listNews(token as string, NEWS_FEED_PAGE_SIZE, offset)
            return {
                events: result.events,
                page,
                pageSize: NEWS_FEED_PAGE_SIZE,
                totalEntries: result.total_entries,
                totalPages: Math.max(1, Math.ceil(result.total_entries / NEWS_FEED_PAGE_SIZE)),
            }
        },
        enabled: token !== null,
    })
}
