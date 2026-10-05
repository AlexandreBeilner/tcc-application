import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { updateCatalogAsset } from '../../../services/admin'
import type { CatalogAsset, CatalogPatch } from '../../../services/admin'
import { ADMIN_CATALOG_QUERY_KEY } from '../useAdminCatalogQuery'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { MARKET_MONITOR_QUERY_KEY } from '../useMarketMonitorQuery'

// Alterar um ativo muda o catálogo daqui, o nome mostrado no monitor de mercado e a auditoria.
export function useUpdateCatalogAssetMutation(): UseMutationResult<CatalogAsset, unknown, { assetId: string; patch: CatalogPatch }> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ assetId, patch }) => updateCatalogAsset(token as string, assetId, patch),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ADMIN_CATALOG_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: MARKET_MONITOR_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
        },
    })
}
