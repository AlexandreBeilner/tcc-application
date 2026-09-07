import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getSocialFeed } from '../../../services/socialfeed'
import type { GetSocialFeedResult } from '../../../services/socialfeed'

export function useFeedQuery(): UseQueryResult<GetSocialFeedResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['social-feed'] as const,
        queryFn: () => getSocialFeed(token as string),
        enabled: token !== null,
    })
}
