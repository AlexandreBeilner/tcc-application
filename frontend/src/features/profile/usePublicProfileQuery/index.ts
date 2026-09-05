import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getUserProfile } from '../../../services/profile'
import type { PublicProfile } from '../../../services/profile'

// Tela 8.4 — `window` fixo em `week`, sem toggle (inventário não pede um
// pra esta tela, diferente da Classificação, 6.8).
export function usePublicProfileQuery(userId: string): UseQueryResult<{ profile: PublicProfile }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['profile', userId] as const,
        queryFn: () => getUserProfile(token as string, userId),
        enabled: token !== null && userId.length > 0,
    })
}
