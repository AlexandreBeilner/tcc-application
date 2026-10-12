import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { liftAssemblyPause, listAssemblyPauses, pauseAssemblies } from '../../../services/admin'
import type { AssemblyPause, AssemblyPauseListing, PauseAssembliesInput } from '../../../services/admin'
import { useAdminReauth } from '../AdminReauth'
import { ADMIN_ASSEMBLIES_QUERY_KEY } from '../useAdminAssembliesQuery'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const ASSEMBLY_PAUSES_QUERY_KEY = ['admin', 'assembly-pauses'] as const

export function useAssemblyPausesQuery(): UseQueryResult<AssemblyPauseListing> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ASSEMBLY_PAUSES_QUERY_KEY,
        queryFn: () => listAssemblyPauses(token as string),
        enabled: token !== null,
        refetchInterval: 30_000,
    })
}

// Pausar e retomar mudam a lista, a marca "pausada" das assembleias e a auditoria. Invalida no
// `onSettled`: um 409 (já pausado ou já retomado) também deixa a lista velha.
function useInvalidatePauseQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ASSEMBLY_PAUSES_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: ADMIN_ASSEMBLIES_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function usePauseAssembliesMutation(): UseMutationResult<AssemblyPause, unknown, PauseAssembliesInput> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidatePauseQueries()

    return useMutation({
        mutationFn: (input: PauseAssembliesInput) => withReauth((t) => pauseAssemblies(t, input)),
        onSettled: invalidate,
    })
}

export function useLiftAssemblyPauseMutation(): UseMutationResult<AssemblyPause, unknown, string> {
    const { token } = useAuth()
    const invalidate = useInvalidatePauseQueries()

    return useMutation({
        mutationFn: (pauseId: string) => liftAssemblyPause(token as string, pauseId),
        onSettled: invalidate,
    })
}
