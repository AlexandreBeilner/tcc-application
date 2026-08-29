import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAssetQuotes } from '../../../services/market'
import type { QuoteHistoryEntry } from '../../../services/market'

export function useAssetQuotesQuery(assetId: string, days: number): UseQueryResult<{ quotes: QuoteHistoryEntry[] }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['market', 'assets', 'quotes', assetId, days] as const,
        queryFn: () => getAssetQuotes(token as string, assetId, days),
        enabled: token !== null,
    })
}
