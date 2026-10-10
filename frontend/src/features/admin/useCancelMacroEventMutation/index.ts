import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { cancelMacroEvent } from '../../../services/admin'
import type { CancelMacroEventResult } from '../../../services/admin'
import { NEWS_FEED_QUERY_KEY } from '../../news/useNewsFeedQuery'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { MACRO_EVENT_DETAIL_QUERY_KEY } from '../useMacroEventDetailQuery'
import { MACRO_EVENTS_QUERY_KEY } from '../useMacroEventsQuery'

// Cancelar muda o histórico, o detalhe, a auditoria e o feed do usuário. Invalida no
// `onSettled`: um 409 (já aplicado, efeito começou, tick em andamento) também deixa o
// estado em tela velho.
export function useCancelMacroEventMutation(): UseMutationResult<CancelMacroEventResult, unknown, string> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => cancelMacroEvent(token as string, id),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: MACRO_EVENTS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: MACRO_EVENT_DETAIL_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: NEWS_FEED_QUERY_KEY })
        },
    })
}
