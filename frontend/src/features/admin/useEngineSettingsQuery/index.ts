import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getEngineSettings } from '../../../services/admin'
import type { EngineSettingGroup, EngineSettings } from '../../../services/admin'

export const ENGINE_SETTINGS_QUERY_KEY = ['admin', 'settings'] as const

export function useEngineSettingsQuery(group: EngineSettingGroup = 'pace'): UseQueryResult<EngineSettings> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...ENGINE_SETTINGS_QUERY_KEY, group],
        queryFn: () => getEngineSettings(token as string, group),
        enabled: token !== null,
    })
}
