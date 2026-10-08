import type { CsvCell } from '../../domain/csv'

export type ExportDataset = 'users' | 'orders' | 'market-events' | 'audit-log'

export const EXPORT_DATASETS: readonly ExportDataset[] = [
  'users',
  'orders',
  'market-events',
  'audit-log',
]

export interface ExportRange {
  from?: Date
  to?: Date
}

export interface ExportTable {
  columns: string[]
  rows: CsvCell[][]
  // Havia mais linhas que o limite: o arquivo traz as primeiras e avisa.
  truncated: boolean
}

// Uma fonte de linhas pra exportação (usuários, ordens, eventos, auditoria). Cada fonte sabe de
// onde lê e QUAIS colunas expõe (a regra de privacidade mora em cada uma, nunca no formato).
export interface ExportSource {
  fetch(range: ExportRange, limit: number): Promise<ExportTable>
}
