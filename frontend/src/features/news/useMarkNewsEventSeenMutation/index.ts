import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData, UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { markNewsEventSeen } from '../../../services/news'
import type { ListNewsResult } from '../../../services/news'
import { NEWS_FEED_QUERY_KEY } from '../useNewsFeedQuery'

// `POST /news/:id/seen` é idempotente (`.docs/backend/news.md`) — chamada
// direto na primeira expansão de um evento ainda não visto (NewsEventList,
// `onEventOpen`), sem checar `seen` de novo aqui (já checado no organism).
//
// `onSuccess` corrige localmente o `seen` do evento em vez de invalidar a
// query inteira (`useInfiniteQuery`): invalidar refaz todas as páginas já
// carregadas via "Carregar mais" só pra virar um booleano, gerando N
// requisições e um flicker no feed inteiro por causa de um clique num único
// evento.
export function useMarkNewsEventSeenMutation(): UseMutationResult<void, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (eventId: string) => markNewsEventSeen(token as string, eventId),
        onSuccess: (_data, eventId) => {
            queryClient.setQueryData<InfiniteData<ListNewsResult, number>>(NEWS_FEED_QUERY_KEY, (old) => {
                if (!old) return old
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        events: page.events.map((event) => (event.id === eventId ? { ...event, seen: true } : event)),
                    })),
                }
            })
        },
    })
}
