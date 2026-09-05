import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listFriends } from '../../../services/friendships'
import type { FriendsSortOrder, ListFriendsResult } from '../../../services/friendships'

export const FRIENDS_QUERY_KEY = ['friendships', 'friends'] as const

// `page`/`sort` mudam por seleção explícita do usuário (paginação/Select de
// ordenação, 6.9.1), nunca por digitação — sem debounce, mesmo raciocínio
// de `useRankingQuery`.
export function useFriendsQuery(page: number, sort: FriendsSortOrder): UseQueryResult<ListFriendsResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...FRIENDS_QUERY_KEY, page, sort] as const,
        queryFn: () => listFriends(token as string, page, sort),
        enabled: token !== null,
    })
}
