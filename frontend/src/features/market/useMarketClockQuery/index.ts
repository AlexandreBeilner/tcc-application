import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getMarketClock } from '../../../services/market'
import type { MarketClock } from '../../../services/market'

export const MARKET_CLOCK_QUERY_KEY = ['market', 'clock'] as const

// O relógio muda a cada tick (~4h48 reais com o fator 5), então uma leitura por
// minuto basta pra "abre em 4h12" e pra reabrir os botões na segunda-feira.
const REFETCH_INTERVAL_MS = 60_000

export function useMarketClockQuery(): UseQueryResult<MarketClock> {
    const { token } = useAuth()

    return useQuery({
        queryKey: MARKET_CLOCK_QUERY_KEY,
        queryFn: () => getMarketClock(token as string),
        enabled: token !== null,
        refetchInterval: REFETCH_INTERVAL_MS,
        staleTime: 30_000,
    })
}
