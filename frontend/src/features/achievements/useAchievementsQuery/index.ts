import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAchievements } from '../../../services/achievements'
import type { ListAchievementsResult } from '../../../services/achievements'

export function useAchievementsQuery(): UseQueryResult<ListAchievementsResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['achievements'] as const,
        queryFn: () => listAchievements(token as string),
        enabled: token !== null,
    })
}
