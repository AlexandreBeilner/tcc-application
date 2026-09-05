import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listFriendRequests } from '../../../services/friendships'
import type { FriendRequest } from '../../../services/friendships'
import { fetchAllPages } from '../../../utils/fetchAllPages'
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

            const [received, sent] = await Promise.all([
                fetchAllPages(first.received.totalPages, first.received.items, async (page) => {
                    const result = await listFriendRequests(token as string, page, 1, 'desc')
                    return result.received.items
                }),
                fetchAllPages(first.sent.totalPages, first.sent.items, async (page) => {
                    const result = await listFriendRequests(token as string, 1, page, 'desc')
                    return result.sent.items
                }),
            ])

            return { received, sent }
        },
        enabled: token !== null,
    })
}
