import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAdminBots } from '../../../services/admin'
import type { AdminBotListing } from '../../../services/admin'

export const ADMIN_BOTS_QUERY_KEY = ['admin', 'bots'] as const

export function useAdminBotsQuery(): UseQueryResult<AdminBotListing> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ADMIN_BOTS_QUERY_KEY,
        queryFn: () => listAdminBots(token as string),
        enabled: token !== null,
        // Caixa e posições mudam a cada rodada de bots.
        refetchInterval: 30_000,
    })
}
