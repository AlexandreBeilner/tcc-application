import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { downloadAdminExport } from '../../../services/admin'
import type { ExportDataset, ExportFilters } from '../../../services/admin'
import { saveBlobAsFile } from '../adminExports'
import { useAdminReauth } from '../AdminReauth'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export interface ExportResult {
    filename: string
    rows: number
    truncated: boolean
}

// Gera o CSV e entrega ao navegador. A exportação de usuários traz e-mail e pede senha recente
// (`reauth_required`); passar tudo por `withReauth` é inofensivo nos outros conjuntos, que nunca
// devolvem esse código. Exportar grava uma linha na auditoria, então a lista dela fica velha.
export function useExportDownloadMutation(): UseMutationResult<ExportResult, unknown, { dataset: ExportDataset; filters: ExportFilters }> {
    const { withReauth } = useAdminReauth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ dataset, filters }) => {
            const file = await withReauth((token) => downloadAdminExport(token, dataset, filters))
            saveBlobAsFile(file.blob, file.filename)
            return { filename: file.filename, rows: file.rows, truncated: file.truncated }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
        },
    })
}
