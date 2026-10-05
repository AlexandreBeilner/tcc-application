import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getAdminBotActivity } from '../../../services/admin'
import type { BotActivity } from '../../../services/admin'

export const ADMIN_BOT_ACTIVITY_QUERY_KEY = ['admin', 'bots', 'activity'] as const

// Desempenho de um bot na janela de `days` dias simulados. `botId` nulo (nenhum painel aberto)
// não consulta nada.
export function useAdminBotActivityQuery(botId: string | null, days: number): UseQueryResult<BotActivity> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...ADMIN_BOT_ACTIVITY_QUERY_KEY, botId, days],
        queryFn: () => getAdminBotActivity(token as string, botId as string, days),
        enabled: token !== null && botId !== null,
        refetchInterval: 30_000,
    })
}
