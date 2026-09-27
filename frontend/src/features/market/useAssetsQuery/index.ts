import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAssets } from '../../../services/market'
import type { AssetSummary, AssetType } from '../../../services/market'

export function assetsQueryKey(type?: AssetType, includeSandbox = false) {
    return ['market', 'assets', type ?? 'all', includeSandbox ? 'with-sandbox' : 'real'] as const
}

// `includeSandbox` só pra quem precisa achar/rotular o ativo do Modo
// Aprendizado (lição por ticker, extrato) — o resto do app nunca o vê (S.8).
export function useAssetsQuery(
    type?: AssetType,
    options?: { enabled?: boolean; includeSandbox?: boolean },
): UseQueryResult<{ assets: AssetSummary[] }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: assetsQueryKey(type, options?.includeSandbox),
        queryFn: () => listAssets(token as string, type, options?.includeSandbox),
        enabled: token !== null && (options?.enabled ?? true),
    })
}
