import type { CsvCell } from '../../domain/csv'
import type { ExportRange, ExportSource, ExportTable } from '../../application/ports/exportSource'

// Exportar até 50 mil linhas leva mais que o timeout das rotas de painel.
const REQUEST_TIMEOUT_MS = 30_000

interface EngineRows<T> {
  rows: T[]
  truncated: boolean
}

interface EngineOrderRow {
  id: string
  user_id: string
  is_bot: boolean
  ticker: string
  side: string
  type: string
  quantity: number
  filled_quantity: number
  price: string
  status: string
  cancel_reason: string | null
  simulated_day: number
  created_at: string
}

interface EngineEventRow {
  id: string
  user_id: string
  is_bot: boolean
  ticker: string | null
  event_type: string
  quantity: number | null
  unit_value: string | null
  simulated_day: number
  timestamp: string
}

async function fetchRows<T>(
  engineUrl: string,
  path: string,
  range: ExportRange,
  limit: number,
): Promise<EngineRows<T>> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (range.from) params.set('from', range.from.toISOString())
  if (range.to) params.set('to', range.to.toISOString())
  const res = await fetch(`${engineUrl}${path}?${params.toString()}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`falha ao exportar no motor de simulação (status ${res.status})`)
  }
  return (await res.json()) as EngineRows<T>
}

// As linhas identificam a conta só pelo id (nome e e-mail ficam no backend) e não carregam
// patrimônio agregado: o motor já não os expõe, e esta fonte só repassa as colunas abaixo.
export function createEngineOrdersExportSource(engineUrl: string): ExportSource {
  return {
    async fetch(range, limit): Promise<ExportTable> {
      const { rows, truncated } = await fetchRows<EngineOrderRow>(
        engineUrl,
        '/admin/export/orders',
        range,
        limit,
      )
      return {
        columns: [
          'id',
          'user_id',
          'is_bot',
          'ticker',
          'side',
          'type',
          'quantity',
          'filled_quantity',
          'price',
          'status',
          'cancel_reason',
          'simulated_day',
          'created_at',
        ],
        rows: rows.map((o): CsvCell[] => [
          o.id,
          o.user_id,
          o.is_bot,
          o.ticker,
          o.side,
          o.type,
          o.quantity,
          o.filled_quantity,
          o.price,
          o.status,
          o.cancel_reason,
          o.simulated_day,
          o.created_at,
        ]),
        truncated,
      }
    },
  }
}

export function createEngineEventsExportSource(engineUrl: string): ExportSource {
  return {
    async fetch(range, limit): Promise<ExportTable> {
      const { rows, truncated } = await fetchRows<EngineEventRow>(
        engineUrl,
        '/admin/export/events',
        range,
        limit,
      )
      return {
        columns: [
          'id',
          'user_id',
          'is_bot',
          'ticker',
          'event_type',
          'quantity',
          'unit_value',
          'simulated_day',
          'timestamp',
        ],
        rows: rows.map((e): CsvCell[] => [
          e.id,
          e.user_id,
          e.is_bot,
          e.ticker,
          e.event_type,
          e.quantity,
          e.unit_value,
          e.simulated_day,
          e.timestamp,
        ]),
        truncated,
      }
    },
  }
}
