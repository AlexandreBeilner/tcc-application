import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { createAdminBot, updateAdminBot } from '../../../services/admin'
import type { AdminBot, CreateBotInput, UpdateBotInput } from '../../../services/admin'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { MARKET_MONITOR_QUERY_KEY } from '../useMarketMonitorQuery'
import { ADMIN_BOTS_QUERY_KEY } from '../useAdminBotsQuery'

// Criar e alterar mexem na lista de bots, na cobertura que o monitor do mercado mostra e na
// auditoria. Invalida no `onSettled`: uma recusa (409, ativo já coberto) também deixa a lista velha.
function useInvalidateBotQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ADMIN_BOTS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: MARKET_MONITOR_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function useCreateAdminBotMutation(): UseMutationResult<AdminBot, unknown, CreateBotInput> {
    const { token } = useAuth()
    const invalidate = useInvalidateBotQueries()

    return useMutation({
        mutationFn: (input: CreateBotInput) => createAdminBot(token as string, input),
        onSettled: invalidate,
    })
}

export interface UpdateBotVariables {
    botId: string
    input: UpdateBotInput
}

export function useUpdateAdminBotMutation(): UseMutationResult<AdminBot, unknown, UpdateBotVariables> {
    const { token } = useAuth()
    const invalidate = useInvalidateBotQueries()

    return useMutation({
        mutationFn: ({ botId, input }: UpdateBotVariables) => updateAdminBot(token as string, botId, input),
        onSettled: invalidate,
    })
}
