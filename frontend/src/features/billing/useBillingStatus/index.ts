import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'

export const BILLING_STATUS_QUERY_KEY = ['billing', 'status'] as const

// Plano da conta (MO.3.1). `refetchInterval` só é usado pelo retorno da compra (MO.3.2), que
// passa um intervalo enquanto espera o webhook confirmar.
export function useBillingStatusQuery(refetchInterval: number | false = false): UseQueryResult<BillingStatus> {
    const { token } = useAuth()

    return useQuery({
        queryKey: BILLING_STATUS_QUERY_KEY,
        queryFn: () => getBillingStatus(token as string),
        enabled: token !== null,
        refetchInterval,
    })
}
