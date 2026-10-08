import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getIntegrityRun, startIntegrityCheck } from '../../../services/admin'
import type { IntegrityRun } from '../../../services/admin'
import { isRunning } from '../integrity'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const INTEGRITY_RUN_QUERY_KEY = ['admin', 'integrity'] as const

// Enquanto a verificação roda, consulta a cada 2 s; depois de terminar não consulta mais.
const RUNNING_POLL_MS = 2000

export function useIntegrityRunQuery(): UseQueryResult<IntegrityRun | null> {
    const { token } = useAuth()

    return useQuery({
        queryKey: INTEGRITY_RUN_QUERY_KEY,
        queryFn: () => getIntegrityRun(token as string),
        enabled: token !== null,
        refetchInterval: (query) => (isRunning(query.state.data) ? RUNNING_POLL_MS : false),
    })
}

export function useStartIntegrityCheckMutation(): UseMutationResult<IntegrityRun, unknown, void> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => startIntegrityCheck(token as string),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: INTEGRITY_RUN_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
        },
    })
}
