import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { createDailyApi } from '..'
import { API_BASE_URL } from '../../../services/client'

export const DAILY_TODAY_QUERY_KEY = ['daily', 'today'] as const

export type DailyToday = { status: 'off' | 'scheduled' } | { status: 'live'; number: number; completed: boolean }

// Estado do Diário de hoje para o convite no app (DI.4.2): está no ar e esta conta já fechou os três
// cartões? O servidor decide ambos (`GET /daily/today` e `GET /daily/:n/me`).
export function useDailyToday(): UseQueryResult<DailyToday> {
    const { token } = useAuth()

    return useQuery({
        queryKey: DAILY_TODAY_QUERY_KEY,
        enabled: token !== null,
        staleTime: 60_000,
        queryFn: async (): Promise<DailyToday> => {
            const api = createDailyApi({ baseUrl: API_BASE_URL, getToken: () => token })
            const today = await api.today()
            if (today.status !== 'live') return { status: today.status }
            const mine = (await api.me(today.game.number)) as { completed?: unknown } | null
            return { status: 'live', number: today.game.number, completed: mine?.completed === true }
        },
    })
}
