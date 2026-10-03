import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { liftTradingHalt, pauseTrading } from '../../../services/admin'
import type { PauseTradingInput, TradingHalt } from '../../../services/admin'
import { useAdminReauth } from '../AdminReauth'
import { TRADING_HALTS_QUERY_KEY } from '../../market/useTradingHaltQuery'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { TRADING_HALTS_ADMIN_QUERY_KEY } from '../useTradingHaltsQuery'

// Pausar e retomar mudam a lista do painel, o aviso que o usuário lê e a auditoria.
// Invalida no `onSettled`: um 409 (já pausado/já retomado) também deixa a lista velha.
function useInvalidateHaltQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: TRADING_HALTS_ADMIN_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: TRADING_HALTS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function usePauseTradingMutation(): UseMutationResult<TradingHalt, unknown, PauseTradingInput> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateHaltQueries()

    return useMutation({
        mutationFn: (input: PauseTradingInput) => withReauth((t) => pauseTrading(t, input)),
        onSettled: invalidate,
    })
}

export function useLiftTradingHaltMutation(): UseMutationResult<TradingHalt, unknown, string> {
    const { token } = useAuth()
    const invalidate = useInvalidateHaltQueries()

    return useMutation({
        mutationFn: (haltId: string) => liftTradingHalt(token as string, haltId),
        onSettled: invalidate,
    })
}
