import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAssemblySettings, resetAssemblySetting, updateAssemblySetting } from '../../../services/admin'
import type { AssemblySetting, AssemblySettingKey } from '../../../services/admin'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const ASSEMBLY_SETTINGS_QUERY_KEY = ['admin', 'assembly-settings'] as const

export function useAssemblySettingsQuery(): UseQueryResult<AssemblySetting[]> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ASSEMBLY_SETTINGS_QUERY_KEY,
        queryFn: () => listAssemblySettings(token as string),
        enabled: token !== null,
    })
}

function useInvalidateSettingQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ASSEMBLY_SETTINGS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function useUpdateAssemblySettingMutation(): UseMutationResult<
    AssemblySetting[],
    unknown,
    { key: AssemblySettingKey; value: number }
> {
    const { token } = useAuth()
    const invalidate = useInvalidateSettingQueries()

    return useMutation({
        mutationFn: ({ key, value }) => updateAssemblySetting(token as string, key, value),
        onSettled: invalidate,
    })
}

export function useResetAssemblySettingMutation(): UseMutationResult<AssemblySetting[], unknown, AssemblySettingKey> {
    const { token } = useAuth()
    const invalidate = useInvalidateSettingQueries()

    return useMutation({
        mutationFn: (key: AssemblySettingKey) => resetAssemblySetting(token as string, key),
        onSettled: invalidate,
    })
}
