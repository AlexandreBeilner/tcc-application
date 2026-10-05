import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getScheduler } from '../../../services/admin'
import type { SchedulerStatus } from '../../../services/admin'

export const SCHEDULER_QUERY_KEY = ['admin', 'scheduler'] as const

// Atualiza sozinho: o estado muda sem ação do admin (próximo slot passa, um tick
// agendado começa e termina).
const REFETCH_MS = 15_000

export function useSchedulerQuery(): UseQueryResult<SchedulerStatus> {
    const { token } = useAuth()

    return useQuery({
        queryKey: SCHEDULER_QUERY_KEY,
        queryFn: () => getScheduler(token as string),
        enabled: token !== null,
        refetchInterval: REFETCH_MS,
    })
}
