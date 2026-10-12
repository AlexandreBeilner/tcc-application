import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAdminAssembly, listAdminAssemblies } from '../../../services/admin'
import type { AdminAssembly, AdminAssemblyDetail, AdminAssemblyStatus } from '../../../services/admin'

export const ADMIN_ASSEMBLIES_QUERY_KEY = ['admin', 'assemblies'] as const

export function useAdminAssembliesQuery(status?: AdminAssemblyStatus): UseQueryResult<AdminAssembly[]> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...ADMIN_ASSEMBLIES_QUERY_KEY, 'list', status ?? 'all'],
        queryFn: () => listAdminAssemblies(token as string, status),
        enabled: token !== null,
        refetchInterval: 30_000,
    })
}

// Detalhe com voto por pessoa (exceção deliberada do painel: a leitura não é auditada).
export function useAdminAssemblyDetailQuery(id: string | undefined): UseQueryResult<AdminAssemblyDetail> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...ADMIN_ASSEMBLIES_QUERY_KEY, 'detail', id],
        queryFn: () => getAdminAssembly(token as string, id as string),
        enabled: token !== null && id !== undefined,
    })
}
