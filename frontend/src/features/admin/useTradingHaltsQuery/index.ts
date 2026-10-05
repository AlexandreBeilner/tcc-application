import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listTradingHalts } from '../../../services/admin'
import type { TradingHaltListing } from '../../../services/admin'

export const TRADING_HALTS_ADMIN_QUERY_KEY = ['admin', 'halts'] as const

export function useTradingHaltsQuery(): UseQueryResult<TradingHaltListing> {
    const { token } = useAuth()

    return useQuery({
        queryKey: TRADING_HALTS_ADMIN_QUERY_KEY,
        queryFn: () => listTradingHalts(token as string),
        enabled: token !== null,
        refetchInterval: 15_000,
    })
}
