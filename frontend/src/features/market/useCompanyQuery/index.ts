import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getCompany } from '../../../services/market'
import type { Company } from '../../../services/market'

export function useCompanyQuery(companyId: string): UseQueryResult<{ company: Company }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['market', 'companies', companyId] as const,
        queryFn: () => getCompany(token as string, companyId),
        enabled: token !== null,
    })
}
