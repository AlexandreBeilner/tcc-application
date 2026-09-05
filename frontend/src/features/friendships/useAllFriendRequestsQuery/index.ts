import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listFriendRequests } from '../../../services/friendships'
import type { FriendRequest } from '../../../services/friendships'
import { FRIEND_REQUESTS_QUERY_KEY } from '../useFriendRequestsQuery'

export const ALL_FRIEND_REQUESTS_QUERY_KEY = [...FRIEND_REQUESTS_QUERY_KEY, 'all'] as const

export interface AllFriendRequests {
    received: FriendRequest[]
    sent: FriendRequest[]
}

// Mesmo raciocínio de `useAllFriendsQuery` — `resolveFriendshipStatus`
// (8.2/8.4) precisa checar as duas listas inteiras, não a página exibida
// em 8.3. Busca todas as páginas de cada lista (independentes uma da
// outra, mesmo critério de paginação da 6.9.1) e junta.
export function useAllFriendRequestsQuery(): UseQueryResult<AllFriendRequests> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ALL_FRIEND_REQUESTS_QUERY_KEY,
        queryFn: async (): Promise<AllFriendRequests> => {
            const first = await listFriendRequests(token as string, 1, 1, 'desc')

            const receivedRest = await Promise.all(
                Array.from({ length: first.received.totalPages - 1 }, (_, index) =>
                    listFriendRequests(token as string, index + 2, 1, 'desc'),
                ),
            )
            const sentRest = await Promise.all(
                Array.from({ length: first.sent.totalPages - 1 }, (_, index) => listFriendRequests(token as string, 1, index + 2, 'desc')),
            )

            return {
                received: [...first.received.items, ...receivedRest.flatMap((result) => result.received.items)],
                sent: [...first.sent.items, ...sentRest.flatMap((result) => result.sent.items)],
            }
        },
        enabled: token !== null,
    })
}
