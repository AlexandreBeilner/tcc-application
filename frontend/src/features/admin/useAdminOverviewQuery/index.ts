import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAdminOverview } from '../../../services/admin'
import type { AdminOverview } from '../../../services/admin'

export const ADMIN_OVERVIEW_QUERY_KEY = ['admin', 'overview'] as const

const REFETCH_MS = 15_000

export function useAdminOverviewQuery(): UseQueryResult<AdminOverview> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ADMIN_OVERVIEW_QUERY_KEY,
        queryFn: () => getAdminOverview(token as string),
        enabled: token !== null,
        refetchInterval: REFETCH_MS,
    })
}
