import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAdminCatalog } from '../../../services/admin'
import type { CatalogAsset } from '../../../services/admin'

export const ADMIN_CATALOG_QUERY_KEY = ['admin', 'catalog'] as const

export function useAdminCatalogQuery(): UseQueryResult<CatalogAsset[]> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ADMIN_CATALOG_QUERY_KEY,
        queryFn: () => listAdminCatalog(token as string),
        enabled: token !== null,
    })
}
