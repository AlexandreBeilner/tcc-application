import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getEngineSettings } from '../../../services/admin'
import type { EngineSettings } from '../../../services/admin'

export const ENGINE_SETTINGS_QUERY_KEY = ['admin', 'settings'] as const

export function useEngineSettingsQuery(): UseQueryResult<EngineSettings> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ENGINE_SETTINGS_QUERY_KEY,
        queryFn: () => getEngineSettings(token as string),
        enabled: token !== null,
    })
}
