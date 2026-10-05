import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getSystemHealth } from '../../../services/admin'
import type { SystemHealth } from '../../../services/admin'

export const SYSTEM_HEALTH_QUERY_KEY = ['admin', 'system-health'] as const

// Saúde muda sem ação do admin (um componente cai ou volta): polling curto.
const REFETCH_MS = 15_000

export function useSystemHealthQuery(): UseQueryResult<SystemHealth> {
    const { token } = useAuth()

    return useQuery({
        queryKey: SYSTEM_HEALTH_QUERY_KEY,
        queryFn: () => getSystemHealth(token as string),
        enabled: token !== null,
        refetchInterval: REFETCH_MS,
    })
}
