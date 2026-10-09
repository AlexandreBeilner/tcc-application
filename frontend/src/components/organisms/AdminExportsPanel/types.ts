import type { ExportFormValues } from '../../../features/admin/adminExports'

export interface AdminExportsPanelProps {
    busy: boolean
    // Resultado do último arquivo gerado, pra mostrar quantas linhas e se foi cortado pelo teto.
    lastResult: { filename: string; rows: number; truncated: boolean } | null
    error: string | null
    onDownload: (values: ExportFormValues) => void
}
