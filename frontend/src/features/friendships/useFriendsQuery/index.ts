import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listFriends } from '../../../services/friendships'
import type { ListFriendsResult } from '../../../services/friendships'

export const FRIENDS_QUERY_KEY = ['friendships', 'friends'] as const

export function useFriendsQuery(): UseQueryResult<ListFriendsResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: FRIENDS_QUERY_KEY,
        queryFn: () => listFriends(token as string),
        enabled: token !== null,
    })
}
