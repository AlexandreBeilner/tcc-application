import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getBillingConversion } from '../../../services/billing'
import type { BillingConversion, ConversionWindow } from '../../../services/billing'

export const BILLING_CONVERSION_QUERY_KEY = ['admin', 'billing', 'conversion'] as const

export function useBillingConversionQuery(days: ConversionWindow): UseQueryResult<BillingConversion> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...BILLING_CONVERSION_QUERY_KEY, days],
        queryFn: () => getBillingConversion(token as string, days),
        enabled: token !== null,
        refetchInterval: 60_000,
    })
}
