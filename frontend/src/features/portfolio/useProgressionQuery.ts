import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getProgression } from '../../services/gamification'
import type { Progression } from '../../services/gamification'

export const PROGRESSION_QUERY_KEY = ['gamification', 'me', 'progression'] as const

export function useProgressionQuery(): UseQueryResult<Progression> {
    const { token } = useAuth()

    return useQuery({
        queryKey: PROGRESSION_QUERY_KEY,
        queryFn: () => getProgression(token as string),
        enabled: token !== null,
    })
}
