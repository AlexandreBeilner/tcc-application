import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { cancelOrder } from '../../../services/market'
import { MY_ORDERS_QUERY_KEY } from '../useMyOrdersQuery'

// Cancelamento manual (tarefa O.1) não mexe em `accounts`/`positions`
// (nenhuma ordem pendurada reserva saldo/posição na submissão,
// `.docs/engine/orders.md`) — diferente de `useMarketMutation`, só invalida
// a própria lista de ordens, não conta/extrato.
export function useCancelOrderMutation(): UseMutationResult<void, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (orderId: string) => cancelOrder(token as string, orderId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MY_ORDERS_QUERY_KEY })
        },
    })
}
