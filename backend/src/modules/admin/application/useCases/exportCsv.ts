import { toCsv } from '../../domain/csv'
import type { ExportDataset, ExportRange, ExportSource } from '../ports/exportSource'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Teto de linhas por arquivo (o do motor também). Acima disso o arquivo sai truncado e marcado,
// pra uma exportação sem filtro não carregar a tabela inteira na memória do backend.
export const MAX_EXPORT_ROWS = 50_000
export const DEFAULT_EXPORT_ROWS = 10_000

export function clampExportLimit(requested: number | undefined): number {
  if (requested === undefined || requested < 1) return DEFAULT_EXPORT_ROWS
  return Math.min(requested, MAX_EXPORT_ROWS)
}

export interface CsvExport {
  filename: string
  csv: string
  rows: number
  truncated: boolean
}

export type ExportSources = Record<ExportDataset, ExportSource>

// Exporta um conjunto de dados em CSV (N.21). A privacidade (RNF09, LGPD) vive em cada fonte,
// que só expõe as colunas permitidas (sem hash de senha nem patrimônio absoluto); aqui ficam o
// teto, o formato e a auditoria (`export.csv` com conjunto, período, linhas e se truncou, mesmo
// quando a leitura falha).
export class ExportCsvUseCase {
  constructor(
    private readonly sources: ExportSources,
    private readonly recordAdminAction: RecordAdminActionUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(
    adminId: string,
    dataset: ExportDataset,
    range: ExportRange,
    requestedLimit?: number,
  ): Promise<CsvExport> {
    const limit = clampExportLimit(requestedLimit)
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'export.csv',
        targetType: 'export',
        targetId: dataset,
        payload: {
          dataset,
          from: range.from?.toISOString() ?? null,
          to: range.to?.toISOString() ?? null,
          limit,
        },
      },
      async () => {
        const table = await this.sources[dataset].fetch(range, limit)
        const day = this.now().toISOString().slice(0, 10).replace(/-/g, '')
        return {
          filename: `${dataset}-${day}.csv`,
          csv: toCsv(table.columns, table.rows),
          rows: table.rows.length,
          truncated: table.truncated,
        }
      },
      (result) => ({ payload: { rows: result.rows, truncated: result.truncated } }),
    )
  }
}
