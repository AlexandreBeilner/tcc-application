import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAdminRetention } from '../../../services/admin'
import type { AdminRetention, AdminRetentionParams } from '../../../services/admin'

export const ADMIN_RETENTION_QUERY_KEY = ['admin', 'retention'] as const

// Os números só mudam quando um dia fecha (e pelos marcos de quem acabou de chegar); um minuto
// basta e poupa o banco de recontar as janelas de 30 dias do MAU a cada olhada.
const REFETCH_MS = 60_000

export function useAdminRetentionQuery(params: AdminRetentionParams): UseQueryResult<AdminRetention> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...ADMIN_RETENTION_QUERY_KEY, params.weeks, params.days],
        queryFn: () => getAdminRetention(token as string, params),
        enabled: token !== null,
        refetchInterval: REFETCH_MS,
        // Trocar a janela não pisca a tela inteira: mantém o que já estava até o novo chegar.
        placeholderData: keepPreviousData,
    })
}
