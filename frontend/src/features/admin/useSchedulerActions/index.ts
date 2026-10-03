import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { advanceTicks, pauseScheduler, resumeScheduler, triggerTick } from '../../../services/admin'
import type { AdvanceTicksResult, SchedulerStatus, TickResult } from '../../../services/admin'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { SCHEDULER_QUERY_KEY } from '../useSchedulerQuery'
import { TICKS_QUERY_KEY } from '../useTicksQuery'

// Toda ação do painel de Tempo muda o estado da agenda, o histórico de ticks e
// o log de auditoria: invalida as três queries pra a tela refletir sem reload.
// O dia do mercado (relógio do app) é outro cache e se atualiza no próprio
// polling dele.
function useInvalidateTimeQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: SCHEDULER_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: TICKS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function useSetSchedulerPausedMutation(): UseMutationResult<SchedulerStatus, unknown, boolean> {
    const { token } = useAuth()
    const invalidate = useInvalidateTimeQueries()

    return useMutation({
        mutationFn: (paused: boolean) => (paused ? pauseScheduler(token as string) : resumeScheduler(token as string)),
        onSuccess: invalidate,
    })
}

export function useTriggerTickMutation(): UseMutationResult<TickResult, unknown, void> {
    const { token } = useAuth()
    const invalidate = useInvalidateTimeQueries()

    return useMutation({
        mutationFn: () => triggerTick(token as string),
        // Também invalida em erro: um 409 mostra "tick em andamento" e o painel
        // precisa refletir isso agora.
        onSettled: invalidate,
    })
}

export function useAdvanceTicksMutation(): UseMutationResult<AdvanceTicksResult, unknown, number> {
    const { token } = useAuth()
    const invalidate = useInvalidateTimeQueries()

    return useMutation({
        mutationFn: (days: number) => advanceTicks(token as string, days),
        // Numa falha no meio, parte dos dias já rodou: o histórico mudou.
        onSettled: invalidate,
    })
}
