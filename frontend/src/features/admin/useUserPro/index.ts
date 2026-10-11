import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { getAdminUserPro, grantAdminUserPro } from '../../../services/admin'
import type { GrantUserProResult, UserProStatus } from '../../../services/admin'
import { useAuth } from '../../auth/AuthContext'
import { useAdminReauth } from '../AdminReauth'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const ADMIN_USER_PRO_QUERY_KEY = ['admin', 'user-pro'] as const

// Plano PRO de uma pessoa (MO.2.5), lido do módulo de cobrança, a mesma fonte do `/billing/status`.
export function useUserProQuery(userId: string): UseQueryResult<UserProStatus> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...ADMIN_USER_PRO_QUERY_KEY, userId] as const,
        queryFn: () => getAdminUserPro(token as string, userId),
        enabled: token !== null,
        retry: false,
    })
}

export interface GrantUserProVariables {
    userId: string
    days: number
    reason: string
}

// A concessão exige senha recente: `withReauth` pede de novo se a conferência venceu.
export function useGrantUserProMutation(): UseMutationResult<GrantUserProResult, unknown, GrantUserProVariables> {
    const { withReauth } = useAdminReauth()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ userId, days, reason }: GrantUserProVariables) =>
            withReauth((token) => grantAdminUserPro(token, userId, { days, reason })),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ADMIN_USER_PRO_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
        },
    })
}
