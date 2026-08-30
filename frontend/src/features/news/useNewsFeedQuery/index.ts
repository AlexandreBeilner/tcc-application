import { useInfiniteQuery } from '@tanstack/react-query'
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listNews } from '../../../services/news'
import type { ListNewsResult } from '../../../services/news'

// Mesmo default de paginação do motor (engine/internal/infra/httpserver/
// macroevents.go, defaultMacroEventListLimit) — tarefa 6.6.1: "Carregar
// mais" acumulando páginas de verdade (useInfiniteQuery), decisão
// confirmada com o usuário de não reaproveitar o atalho de useMyEventsQuery
// (subir o limit numa tirada só) — eventos macro não têm teto natural como
// o extrato de um usuário.
export const NEWS_FEED_PAGE_SIZE = 20

// Query própria do Feed (5.1), separada de `useNewsQuery` (shell/badge) —
// o badge só precisa da primeira página pra saber se surgiu algo novo,
// não acompanha a paginação da tela.
export function useNewsFeedQuery(): UseInfiniteQueryResult<InfiniteData<ListNewsResult, number>> {
    const { token } = useAuth()

    return useInfiniteQuery({
        queryKey: ['news', 'feed'] as const,
        queryFn: ({ pageParam }) => listNews(token as string, NEWS_FEED_PAGE_SIZE, pageParam),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.events.length < NEWS_FEED_PAGE_SIZE ? undefined : allPages.length * NEWS_FEED_PAGE_SIZE,
        enabled: token !== null,
    })
}
