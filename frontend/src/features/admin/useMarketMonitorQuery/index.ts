import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listMarketMonitor } from '../../../services/admin'
import type { MonitorAsset } from '../../../services/admin'

export const MARKET_MONITOR_QUERY_KEY = ['admin', 'market-monitor'] as const

// O book muda a cada rodada de bot; polling curto pra tela "ao vivo".
const REFETCH_MS = 15_000

export function useMarketMonitorQuery(): UseQueryResult<MonitorAsset[]> {
    const { token } = useAuth()

    return useQuery({
        queryKey: MARKET_MONITOR_QUERY_KEY,
        queryFn: async () => (await listMarketMonitor(token as string)).assets,
        enabled: token !== null,
        refetchInterval: REFETCH_MS,
    })
}
