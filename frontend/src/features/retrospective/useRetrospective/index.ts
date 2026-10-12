import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getRetrospective, listRetrospectiveMonths } from '../../../services/retrospectives'
import type { Retrospective } from '../../../services/retrospectives'

export function useRetrospectiveMonthsQuery(): UseQueryResult<string[]> {
    const { token } = useAuth()
    return useQuery({
        queryKey: ['retrospectives', 'months'] as const,
        queryFn: () => listRetrospectiveMonths(token as string),
        enabled: token !== null,
    })
}

// Um mês fechado nunca muda depois de arquivado, então o cache pode ser longo.
export function useRetrospectiveQuery(month: string | null): UseQueryResult<Retrospective> {
    const { token } = useAuth()
    return useQuery({
        queryKey: ['retrospectives', 'month', month] as const,
        queryFn: () => getRetrospective(token as string, month as string),
        enabled: token !== null && month !== null,
        staleTime: 5 * 60 * 1000,
    })
}
