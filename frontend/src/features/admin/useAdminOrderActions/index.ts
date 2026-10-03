import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { cancelAdminOrder, cancelAdminOrdersBatch } from '../../../services/admin'
import type { CancelOrdersBatchInput, CancelOrdersBatchResult } from '../../../services/admin'
import { ADMIN_ORDERS_QUERY_KEY } from '../useAdminOrdersQuery'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { MARKET_MONITOR_QUERY_KEY } from '../useMarketMonitorQuery'

// Cancelar mexe no book (lista de ordens e contagens do monitor) e grava auditoria.
// Invalida no `onSettled`: uma recusa (409, já executada) também deixa a lista velha.
function useInvalidateOrderQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: MARKET_MONITOR_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function useCancelAdminOrderMutation(): UseMutationResult<void, unknown, string> {
    const { token } = useAuth()
    const invalidate = useInvalidateOrderQueries()

    return useMutation({
        mutationFn: (orderId: string) => cancelAdminOrder(token as string, orderId),
        onSettled: invalidate,
    })
}

export function useCancelAdminOrdersBatchMutation(): UseMutationResult<CancelOrdersBatchResult, unknown, CancelOrdersBatchInput> {
    const { token } = useAuth()
    const invalidate = useInvalidateOrderQueries()

    return useMutation({
        mutationFn: (input: CancelOrdersBatchInput) => cancelAdminOrdersBatch(token as string, input),
        onSettled: invalidate,
    })
}
