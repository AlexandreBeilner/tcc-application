import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { resetEngineSetting, updateEngineSetting } from '../../../services/admin'
import type { EngineSettingKey, EngineSettings } from '../../../services/admin'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { SCHEDULER_QUERY_KEY } from '../useSchedulerQuery'
import { ENGINE_SETTINGS_QUERY_KEY } from '../useEngineSettingsQuery'

// Alterar um parâmetro muda a lista, o ritmo mostrado na tela de Tempo e a auditoria.
function useInvalidateSettingQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ENGINE_SETTINGS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: SCHEDULER_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function useUpdateEngineSettingMutation(): UseMutationResult<EngineSettings, unknown, { key: EngineSettingKey; value: number }> {
    const { token } = useAuth()
    const invalidate = useInvalidateSettingQueries()

    return useMutation({
        mutationFn: ({ key, value }) => updateEngineSetting(token as string, key, value),
        onSettled: invalidate,
    })
}

export function useResetEngineSettingMutation(): UseMutationResult<EngineSettings, unknown, EngineSettingKey> {
    const { token } = useAuth()
    const invalidate = useInvalidateSettingQueries()

    return useMutation({
        mutationFn: (key: EngineSettingKey) => resetEngineSetting(token as string, key),
        onSettled: invalidate,
    })
}
