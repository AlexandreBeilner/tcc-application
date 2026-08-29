import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listNews } from '../../../services/news'
import type { ListNewsResult } from '../../../services/news'
import type { UseQueryResult } from '@tanstack/react-query'

// Query única da lista de notícias, compartilhada pelo badge (NewsBell,
// via `useUnreadNews`) e pelo Feed em si (`News.tsx`, tarefa 6.6) — uma
// única declaração garante que os dois consumidores caem no mesmo cache do
// React Query (mesma `queryKey`) em vez de arriscar duas chamadas a
// `GET /news` por causa de uma diferença sutil entre cópias duplicadas.
export const NEWS_QUERY_KEY = ['news', 'badge'] as const

// Badge só precisa saber se surgiu algo novo desde a última visita, não
// acompanhar o feed em tempo real — refetch a cada foco de janela geraria
// uma chamada de rede por alt-tab só pra recalcular um booleano.
const NEWS_STALE_TIME_MS = 60_000

export function useNewsQuery(): UseQueryResult<ListNewsResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: NEWS_QUERY_KEY,
        queryFn: () => listNews(token as string),
        enabled: token !== null,
        staleTime: NEWS_STALE_TIME_MS,
    })
}
