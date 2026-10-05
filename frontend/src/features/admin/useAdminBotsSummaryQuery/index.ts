import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAdminBotsSummary } from '../../../services/admin'
import type { BotsSummary } from '../../../services/admin'

export const ADMIN_BOTS_SUMMARY_QUERY_KEY = ['admin', 'bots', 'summary'] as const

export function useAdminBotsSummaryQuery(): UseQueryResult<BotsSummary> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ADMIN_BOTS_SUMMARY_QUERY_KEY,
        queryFn: () => getAdminBotsSummary(token as string),
        enabled: token !== null,
        refetchInterval: 30_000,
    })
}
