import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAssetPriceSeries } from '../../../services/market'

export const SPARKLINE_DAYS = 30

// Uma consulta para todas as linhas da lista (o backend cacheia 5 min). A sparkline é enfeite: se
// falhar, a lista segue sem ela, por isso sem retry e sem alerta de erro.
export function useAssetPriceSeriesQuery(): UseQueryResult<{ series: Record<string, number[]> }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['market', 'price-series', SPARKLINE_DAYS] as const,
        queryFn: () => getAssetPriceSeries(token as string, SPARKLINE_DAYS),
        enabled: token !== null,
        staleTime: 5 * 60 * 1000,
        retry: false,
    })
}
