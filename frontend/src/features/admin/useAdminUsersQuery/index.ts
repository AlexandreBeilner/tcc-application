import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAdminUsers } from '../../../services/admin'
import type { AdminUserSummary, AdminUsersFilters } from '../../../services/admin'

export const ADMIN_USERS_PAGE_SIZE = 20

export const ADMIN_USERS_QUERY_KEY = ['admin', 'users'] as const

export type AdminUsersQueryFilters = Omit<AdminUsersFilters, 'limit' | 'offset'>

export interface AdminUsersPage {
    users: AdminUserSummary[]
    page: number
    total: number
    totalPages: number
}

// Cadastro não muda a cada segundo: sem polling. Mantém a página anterior na tela
// enquanto o filtro ou a página nova carrega.
export function useAdminUsersQuery(filters: AdminUsersQueryFilters, page: number): UseQueryResult<AdminUsersPage> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...ADMIN_USERS_QUERY_KEY, filters, page] as const,
        queryFn: async () => {
            const result = await listAdminUsers(token as string, {
                ...filters,
                limit: ADMIN_USERS_PAGE_SIZE,
                offset: (page - 1) * ADMIN_USERS_PAGE_SIZE,
            })
            return {
                users: result.users,
                page,
                total: result.total,
                totalPages: Math.max(1, Math.ceil(result.total / ADMIN_USERS_PAGE_SIZE)),
            }
        },
        enabled: token !== null,
        placeholderData: keepPreviousData,
    })
}
