import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getMyProfile } from '../../../services/profile'
import type { PublicProfile } from '../../../services/profile'

// Tela 9.1 "Meu Perfil" (tarefa 6.10) — mesmo princípio de
// `usePublicProfileQuery` (8.4), `window` fixo em `week`.
export function useMyProfileQuery(): UseQueryResult<{ profile: PublicProfile }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['profile', 'me'] as const,
        queryFn: () => getMyProfile(token as string),
        enabled: token !== null,
    })
}
