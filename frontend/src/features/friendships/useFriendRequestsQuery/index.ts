import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listFriendRequests } from '../../../services/friendships'
import type { FriendsSortOrder, ListFriendRequestsResult } from '../../../services/friendships'

export const FRIEND_REQUESTS_QUERY_KEY = ['friendships', 'requests'] as const

// `receivedPage`/`sentPage` paginam de forma independente (6.9.1) — a tela
// 8.3 mostra as duas listas ao mesmo tempo. `FriendsBell` (6.9.4) chama
// este hook só com página 1 de cada lado, pra ler `received.totalEntries`
// como contador do badge — não precisa da lista inteira renderizada.
export function useFriendRequestsQuery(
    receivedPage: number,
    sentPage: number,
    sort: FriendsSortOrder,
): UseQueryResult<ListFriendRequestsResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...FRIEND_REQUESTS_QUERY_KEY, receivedPage, sentPage, sort] as const,
        queryFn: () => listFriendRequests(token as string, receivedPage, sentPage, sort),
        enabled: token !== null,
    })
}
