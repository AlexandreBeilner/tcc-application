import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getMarketCalendar } from '../../../services/market'
import type { MarketCalendar } from '../../../services/market'

// Janela `AAAA-MM-DD` de até 92 dias (limite do motor). `enabled` é do chamador:
// o painel só consulta com ele aberto.
export function useMarketCalendarQuery(from: string | null, to: string | null, enabled: boolean): UseQueryResult<MarketCalendar> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['market', 'calendar', from, to] as const,
        queryFn: () => getMarketCalendar(token as string, from as string, to as string),
        enabled: token !== null && enabled && from !== null && to !== null,
        staleTime: 30_000,
    })
}
