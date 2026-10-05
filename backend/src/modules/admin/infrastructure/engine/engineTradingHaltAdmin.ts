import {
  TradingHaltConflictError,
  TradingHaltNotFoundError,
  TradingHaltRejectedError,
} from '../../domain/errors'
import type {
  TradingHalt,
  TradingHaltAdmin,
  TradingHaltListing,
} from '../../application/ports/tradingHaltAdmin'

const REQUEST_TIMEOUT_MS = 4000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function createEngineTradingHaltAdmin(engineUrl: string): TradingHaltAdmin {
  // Traduz as recusas do motor pra erros de domínio que o router sabe mapear.
  async function readHalt(res: Response, failure: string): Promise<TradingHalt> {
    if (res.status === 400) {
      throw new TradingHaltRejectedError(await errorMessage(res, 'pausa recusada pelo motor'))
    }
    if (res.status === 404) {
      throw new TradingHaltNotFoundError(await errorMessage(res, 'pausa ou ativo não encontrado'))
    }
    if (res.status === 409) {
      throw new TradingHaltConflictError(await errorMessage(res, 'conflito com o estado da pausa'))
    }
    if (!res.ok) {
      throw new Error(`${failure} (status ${res.status})`)
    }
    return (await res.json()) as TradingHalt
  }

  return {
    async list(): Promise<TradingHaltListing> {
      const res = await fetch(`${engineUrl}/admin/halts`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(`falha ao listar as pausas no motor de simulação (status ${res.status})`)
      }
      return (await res.json()) as TradingHaltListing
    },

    async pause(input, adminId) {
      const res = await fetch(`${engineUrl}/admin/halts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: input.scope,
          asset_id: input.assetId,
          reason: input.reason,
          admin_id: adminId,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readHalt(res, 'falha ao pausar a negociação no motor de simulação')
    },

    async lift(haltId, adminId) {
      const res = await fetch(`${engineUrl}/admin/halts/${encodeURIComponent(haltId)}/lift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readHalt(res, 'falha ao retomar a negociação no motor de simulação')
    },
  }
}
