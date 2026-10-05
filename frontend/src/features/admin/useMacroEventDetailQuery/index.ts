import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getMacroEventDetail } from '../../../services/admin'
import type { MacroEventDetail } from '../../../services/admin'

export const MACRO_EVENT_DETAIL_QUERY_KEY = ['admin', 'macro-event'] as const

export function useMacroEventDetailQuery(id: string | undefined, windowDays: number): UseQueryResult<MacroEventDetail> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...MACRO_EVENT_DETAIL_QUERY_KEY, id, windowDays] as const,
        queryFn: () => getMacroEventDetail(token as string, id as string, windowDays),
        enabled: token !== null && id !== undefined,
    })
}
