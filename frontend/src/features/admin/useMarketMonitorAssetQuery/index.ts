import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getMarketMonitorAsset } from '../../../services/admin'
import type { MonitorAssetDetail } from '../../../services/admin'

const REFETCH_MS = 15_000

export function useMarketMonitorAssetQuery(assetId: string | undefined): UseQueryResult<MonitorAssetDetail> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['admin', 'market-monitor', assetId] as const,
        queryFn: () => getMarketMonitorAsset(token as string, assetId as string),
        enabled: token !== null && assetId !== undefined,
        refetchInterval: REFETCH_MS,
        // 404 não melhora com nova tentativa.
        retry: false,
    })
}
