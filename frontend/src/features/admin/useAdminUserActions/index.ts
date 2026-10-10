import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { deleteAdminUser, forceLogoutAdminUser, reactivateAdminUser, suspendAdminUser } from '../../../services/admin'
import { useAdminReauth } from '../AdminReauth'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { ADMIN_USER_DETAIL_QUERY_KEY } from '../useAdminUserDetailQuery'
import { ADMIN_USERS_QUERY_KEY } from '../useAdminUsersQuery'

// Toda ação muda a lista, o detalhe e a auditoria. Invalida no `onSettled`: uma recusa
// (409, conta já suspensa) também deixa a tela velha.
function useInvalidateUserQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: ADMIN_USER_DETAIL_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export interface SuspendUserInput {
    userId: string
    reason: string
}

export function useSuspendUserMutation(): UseMutationResult<void, unknown, SuspendUserInput> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateUserQueries()
    return useMutation({
        mutationFn: ({ userId, reason }: SuspendUserInput) => withReauth((t) => suspendAdminUser(t, userId, reason)),
        onSettled: invalidate,
    })
}

// Reativar devolve acesso, não tira: nunca pede a senha de novo.
export function useReactivateUserMutation(): UseMutationResult<void, unknown, string> {
    const { token } = useAuth()
    const invalidate = useInvalidateUserQueries()
    return useMutation({
        mutationFn: (userId: string) => reactivateAdminUser(token as string, userId),
        onSettled: invalidate,
    })
}

export function useForceLogoutUserMutation(): UseMutationResult<void, unknown, string> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateUserQueries()
    return useMutation({
        mutationFn: (userId: string) => withReauth((t) => forceLogoutAdminUser(t, userId)),
        onSettled: invalidate,
    })
}

export interface DeleteUserInput {
    userId: string
    confirmUsername: string
}

export function useDeleteUserMutation(): UseMutationResult<void, unknown, DeleteUserInput> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateUserQueries()
    return useMutation({
        mutationFn: ({ userId, confirmUsername }: DeleteUserInput) => withReauth((t) => deleteAdminUser(t, userId, confirmUsername)),
        onSettled: invalidate,
    })
}
