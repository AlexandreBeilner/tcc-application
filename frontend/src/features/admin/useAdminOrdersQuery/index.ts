import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAdminOrders } from '../../../services/admin'
import type { AdminOrder, AdminOrdersFilters } from '../../../services/admin'

export const ADMIN_ORDERS_PAGE_SIZE = 25

export const ADMIN_ORDERS_QUERY_KEY = ['admin', 'orders'] as const

export type AdminOrdersQueryFilters = Omit<AdminOrdersFilters, 'limit' | 'offset'>

export interface AdminOrdersPage {
    orders: AdminOrder[]
    page: number
    total: number
    totalPages: number
}

// O book muda a cada rodada de bot: polling curto, mantendo a página anterior na tela
// enquanto o filtro ou a página nova carrega.
export function useAdminOrdersQuery(filters: AdminOrdersQueryFilters, page: number): UseQueryResult<AdminOrdersPage> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...ADMIN_ORDERS_QUERY_KEY, filters, page] as const,
        queryFn: async () => {
            const result = await listAdminOrders(token as string, {
                ...filters,
                limit: ADMIN_ORDERS_PAGE_SIZE,
                offset: (page - 1) * ADMIN_ORDERS_PAGE_SIZE,
            })
            return {
                orders: result.orders,
                page,
                total: result.total,
                totalPages: Math.max(1, Math.ceil(result.total / ADMIN_ORDERS_PAGE_SIZE)),
            }
        },
        enabled: token !== null,
        placeholderData: keepPreviousData,
        refetchInterval: 15_000,
    })
}
