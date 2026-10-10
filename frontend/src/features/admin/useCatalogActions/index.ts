import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { createCatalogAsset, previewCatalogAsset, updateCatalogAsset } from '../../../services/admin'
import type { CatalogAsset, CatalogPatch, CreatedCatalogAsset, NewCatalogAsset, NewCatalogAssetPreview } from '../../../services/admin'
import { ADMIN_BOTS_QUERY_KEY } from '../useAdminBotsQuery'
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

// O preview não grava nada: não invalida nenhuma consulta.
export function usePreviewCatalogAssetMutation(): UseMutationResult<NewCatalogAssetPreview, unknown, NewCatalogAsset> {
    const { token } = useAuth()

    return useMutation({ mutationFn: (asset: NewCatalogAsset) => previewCatalogAsset(token as string, asset) })
}

// Cadastrar um ativo cria bots e cobertura: muda o catálogo, o monitor, a lista de bots e a auditoria.
export function useCreateCatalogAssetMutation(): UseMutationResult<CreatedCatalogAsset, unknown, NewCatalogAsset> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (asset: NewCatalogAsset) => createCatalogAsset(token as string, asset),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ADMIN_CATALOG_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: MARKET_MONITOR_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: ADMIN_BOTS_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
        },
    })
}
