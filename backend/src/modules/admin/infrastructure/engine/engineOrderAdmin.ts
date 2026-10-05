import {
  AdminOrderNotCancellableError,
  AdminOrderNotFoundError,
  BatchTooLargeError,
} from '../../domain/errors'
import type {
  CancelBatchResult,
  ListAdminOrdersQuery,
  ListAdminOrdersResult,
  OrderAdmin,
} from '../../application/ports/orderAdmin'

const REQUEST_TIMEOUT_MS = 4000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function createEngineOrderAdmin(engineUrl: string): OrderAdmin {
  return {
    async list(query: ListAdminOrdersQuery): Promise<ListAdminOrdersResult> {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value))
      }
      const qs = params.toString()
      const res = await fetch(`${engineUrl}/admin/orders${qs ? `?${qs}` : ''}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(`falha ao listar as ordens no motor de simulação (status ${res.status})`)
      }
      return (await res.json()) as ListAdminOrdersResult
    },

    async cancel(orderId: string): Promise<void> {
      const res = await fetch(`${engineUrl}/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.status === 404) {
        throw new AdminOrderNotFoundError(await errorMessage(res, 'ordem não encontrada'))
      }
      if (res.status === 409) {
        throw new AdminOrderNotCancellableError(
          await errorMessage(res, 'ordem não pode ser cancelada neste status'),
        )
      }
      if (!res.ok) {
        throw new Error(`falha ao cancelar a ordem no motor de simulação (status ${res.status})`)
      }
    },

    async cancelBatch(filter): Promise<CancelBatchResult> {
      const res = await fetch(`${engineUrl}/admin/orders/cancel-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: filter.assetId, user_id: filter.userId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.status === 422) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          matched?: number
          max?: number
        }
        throw new BatchTooLargeError(
          body.error ?? 'o filtro atinge ordens demais para um lote',
          body.matched ?? 0,
          body.max ?? 0,
        )
      }
      if (!res.ok) {
        throw new Error(
          `falha ao cancelar as ordens em lote no motor de simulação (status ${res.status})`,
        )
      }
      return (await res.json()) as CancelBatchResult
    },
  }
}
