import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAdminUser } from '../../../services/admin'
import type { AdminUserDetail } from '../../../services/admin'

export const ADMIN_USER_DETAIL_QUERY_KEY = ['admin', 'user'] as const

// Patrimônio e ordens abertas mudam com o mercado: atualiza de tempos em tempos.
export function useAdminUserDetailQuery(userId: string): UseQueryResult<AdminUserDetail> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...ADMIN_USER_DETAIL_QUERY_KEY, userId] as const,
        queryFn: () => getAdminUser(token as string, userId),
        enabled: token !== null,
        refetchInterval: 30_000,
        retry: false,
    })
}
