import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listMyOrders } from '../../../services/market'
import type { MyOrderRecord } from '../../../services/market'

export const MY_ORDERS_QUERY_KEY = ['market', 'me', 'orders'] as const

// Tela "Minhas Ordens" (tarefa O.4).
export function useMyOrdersQuery(): UseQueryResult<{ orders: MyOrderRecord[] }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: MY_ORDERS_QUERY_KEY,
        queryFn: () => listMyOrders(token as string),
        enabled: token !== null,
    })
}
