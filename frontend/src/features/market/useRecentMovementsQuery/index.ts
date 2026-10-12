import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listMyEvents } from '../../../services/market'
import type { MarketEvent } from '../../../services/market'

export const RECENT_EVENTS_QUERY_KEY = ['market', 'me', 'events', 'recent'] as const

// Pede mais que as 10 linhas mostradas porque eventos do sandbox e técnicos saem do feed depois.
export function useRecentMovementsQuery(): UseQueryResult<{ events: MarketEvent[] }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: RECENT_EVENTS_QUERY_KEY,
        queryFn: () => listMyEvents(token as string, 30, 0),
        enabled: token !== null,
    })
}
