import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listFriendRequests } from '../../../services/friendships'
import type { ListFriendRequestsResult } from '../../../services/friendships'

export const FRIEND_REQUESTS_QUERY_KEY = ['friendships', 'requests'] as const

export function useFriendRequestsQuery(): UseQueryResult<ListFriendRequestsResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: FRIEND_REQUESTS_QUERY_KEY,
        queryFn: () => listFriendRequests(token as string),
        enabled: token !== null,
    })
}
