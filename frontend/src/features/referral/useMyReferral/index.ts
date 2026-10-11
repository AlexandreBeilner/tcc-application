import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getMyReferral } from '../../../services/referral'
import type { MyReferral } from '../../../services/referral'

export const MY_REFERRAL_QUERY_KEY = ['referral', 'me'] as const

// Código, contagem e escada de marcos da indicação (MO.7.2).
export function useMyReferralQuery(): UseQueryResult<MyReferral> {
    const { token } = useAuth()

    return useQuery({
        queryKey: MY_REFERRAL_QUERY_KEY,
        queryFn: () => getMyReferral(token as string),
        enabled: token !== null,
    })
}
