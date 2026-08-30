import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { markNewsEventSeen } from '../../../services/news'
import { NEWS_FEED_QUERY_KEY } from '../useNewsFeedQuery'

// `POST /news/:id/seen` é idempotente (`.docs/backend/news.md`) — chamada
// direto na primeira expansão de um evento ainda não visto (NewsEventList,
// `onEventOpen`), sem checar `seen` de novo aqui (já checado no organism).
export function useMarkNewsEventSeenMutation(): UseMutationResult<void, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (eventId: string) => markNewsEventSeen(token as string, eventId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: NEWS_FEED_QUERY_KEY })
        },
    })
}
