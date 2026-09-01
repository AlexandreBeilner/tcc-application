import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { markNewsEventSeen } from '../../../services/news'
import type { NewsFeedPage } from '../useNewsFeedQuery'
import { NEWS_FEED_QUERY_KEY } from '../useNewsFeedQuery'

// `POST /news/:id/seen` é idempotente (`.docs/backend/news.md`) — chamada
// direto na primeira expansão de um evento ainda não visto (NewsEventList,
// `onEventOpen`), sem checar `seen` de novo aqui (já checado no organism).
//
// `onSuccess` corrige localmente o `seen` do evento em vez de invalidar a
// query — invalidar refaria a página atual (e qualquer outra já em cache,
// tarefa 6.9.9 trocou "Carregar mais" por páginas numeradas) só pra virar
// um booleano, gerando requisição(ões) e um flicker no feed por causa de um
// clique num único evento. `setQueriesData` (prefixo `NEWS_FEED_QUERY_KEY`,
// sem o `page` no fim) atinge todas as páginas do feed já em cache, não só
// a corrente.
export function useMarkNewsEventSeenMutation(): UseMutationResult<void, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (eventId: string) => markNewsEventSeen(token as string, eventId),
        onSuccess: (_data, eventId) => {
            queryClient.setQueriesData<NewsFeedPage>({ queryKey: NEWS_FEED_QUERY_KEY }, (old) => {
                if (!old) return old
                return { ...old, events: old.events.map((event) => (event.id === eventId ? { ...event, seen: true } : event)) }
            })
        },
    })
}
