import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listTicks } from '../../../services/admin'
import type { TickRun } from '../../../services/admin'

export const TICKS_PAGE_SIZE = 20

export const TICKS_QUERY_KEY = ['admin', 'ticks'] as const

export interface TicksPage {
    ticks: TickRun[]
    page: number
    totalEntries: number
    totalPages: number
}

export function useTicksQuery(page: number): UseQueryResult<TicksPage> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...TICKS_QUERY_KEY, page] as const,
        queryFn: async () => {
            const result = await listTicks(token as string, TICKS_PAGE_SIZE, (page - 1) * TICKS_PAGE_SIZE)
            return {
                ticks: result.ticks,
                page,
                totalEntries: result.total_entries,
                totalPages: Math.max(1, Math.ceil(result.total_entries / TICKS_PAGE_SIZE)),
            }
        },
        enabled: token !== null,
        placeholderData: keepPreviousData,
        refetchInterval: 30_000,
    })
}
