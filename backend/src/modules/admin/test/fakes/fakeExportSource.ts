import type { ExportRange, ExportSource, ExportTable } from '../../application/ports/exportSource'

export interface FakeExportSource extends ExportSource {
  calls: Array<{ range: ExportRange; limit: number }>
  table: ExportTable
  errorToThrow?: Error
}

export function createFakeExportSource(table?: Partial<ExportTable>): FakeExportSource {
  const fake: FakeExportSource = {
    calls: [],
    table: {
      columns: ['id', 'name'],
      rows: [
        ['1', 'Ana'],
        ['2', '=HYPERLINK("http://x")'],
      ],
      truncated: false,
      ...table,
    },
    errorToThrow: undefined,
    async fetch(range, limit) {
      fake.calls.push({ range, limit })
      if (fake.errorToThrow) throw fake.errorToThrow
      return fake.table
    },
  }
  return fake
}
