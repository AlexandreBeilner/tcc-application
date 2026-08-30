import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listMissions } from '../../../services/missions'
import type { ListMissionsResult } from '../../../services/missions'

export const MISSIONS_QUERY_KEY = ['missions', 'daily'] as const

export function useMissionsQuery(): UseQueryResult<ListMissionsResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: MISSIONS_QUERY_KEY,
        queryFn: () => listMissions(token as string),
        enabled: token !== null,
    })
}
