import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAsset } from '../../../services/market'
import type { AssetDetail } from '../../../services/market'

export function assetQueryKey(assetId: string) {
    return ['market', 'assets', 'detail', assetId] as const
}

export function useAssetQuery(assetId: string, options?: { enabled?: boolean }): UseQueryResult<{ asset: AssetDetail }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: assetQueryKey(assetId),
        queryFn: () => getAsset(token as string, assetId),
        enabled: token !== null && assetId !== '' && (options?.enabled ?? true),
    })
}
