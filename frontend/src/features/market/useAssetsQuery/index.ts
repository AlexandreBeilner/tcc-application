import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAssets } from '../../../services/market'
import type { AssetSummary, AssetType } from '../../../services/market'

export function assetsQueryKey(type?: AssetType) {
    return ['market', 'assets', type ?? 'all'] as const
}

export function useAssetsQuery(type?: AssetType, options?: { enabled?: boolean }): UseQueryResult<{ assets: AssetSummary[] }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: assetsQueryKey(type),
        queryFn: () => listAssets(token as string, type),
        enabled: token !== null && (options?.enabled ?? true),
    })
}
