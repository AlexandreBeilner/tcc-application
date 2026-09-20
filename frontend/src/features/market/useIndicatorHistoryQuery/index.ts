import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getIndicatorHistory } from '../../../services/market'
import type { IndicatorHistoryEntry } from '../../../services/market'

export function useIndicatorHistoryQuery(days: number): UseQueryResult<{ indicators: IndicatorHistoryEntry[] }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['market', 'indicators', days] as const,
        queryFn: () => getIndicatorHistory(token as string, days),
        enabled: token !== null,
    })
}
