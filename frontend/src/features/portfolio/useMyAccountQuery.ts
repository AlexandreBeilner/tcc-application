import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getMyAccount } from '../../services/market'
import type { MyAccount } from '../../services/market'

export const MY_ACCOUNT_QUERY_KEY = ['market', 'me', 'account'] as const

export function useMyAccountQuery(): UseQueryResult<MyAccount> {
    const { token } = useAuth()

    return useQuery({
        queryKey: MY_ACCOUNT_QUERY_KEY,
        queryFn: () => getMyAccount(token as string),
        enabled: token !== null,
    })
}
