import {
  BatchTooLargeError,
  BotConflictError,
  BotNotFoundError,
  BotRejectedError,
} from '../../domain/errors'
import type { AdminBot, AdminBotListing, BotAdmin } from '../../application/ports/botAdmin'

const REQUEST_TIMEOUT_MS = 4000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function createEngineBotAdmin(engineUrl: string): BotAdmin {
  // Traduz as recusas do motor pra erros de domínio que o router sabe mapear.
  async function readBot(res: Response, failure: string): Promise<AdminBot> {
    if (res.status === 400) {
      throw new BotRejectedError(await errorMessage(res, 'bot recusado pelo motor'))
    }
    if (res.status === 404) {
      throw new BotNotFoundError(await errorMessage(res, 'bot não encontrado'))
    }
    if (res.status === 409) {
      throw new BotConflictError(await errorMessage(res, 'conflito com o estado do bot'))
    }
    if (res.status === 422) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        matched?: number
        max?: number
      }
      throw new BatchTooLargeError(
        body.error ?? 'o Market Maker tem ordens demais no ativo para cancelar de uma vez',
        body.matched ?? 0,
        body.max ?? 0,
      )
    }
    if (!res.ok) {
      throw new Error(`${failure} (status ${res.status})`)
    }
    return (await res.json()) as AdminBot
  }

  return {
    async list(): Promise<AdminBotListing> {
      const res = await fetch(`${engineUrl}/admin/bots`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(`falha ao listar os bots no motor de simulação (status ${res.status})`)
      }
      return (await res.json()) as AdminBotListing
    },

    async create(input) {
      const res = await fetch(`${engineUrl}/admin/bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archetype: input.archetype,
          sectors: input.sectors,
          risk_classes: input.riskClasses,
          asset_classes: input.assetClasses,
          within_scope_pct: input.withinScopePct,
          knowledge_level: input.knowledgeLevel,
          max_position_size_pct: input.maxPositionSizePct,
          market_order_preference: input.marketOrderPreference,
          spread_width_pct: input.spreadWidthPct,
          max_covered_assets: input.maxCoveredAssets,
          initial_cash: input.initialCash,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readBot(res, 'falha ao criar o bot no motor de simulação')
    },

    async update(botId, input) {
      const res = await fetch(`${engineUrl}/admin/bots/${encodeURIComponent(botId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: input.isActive,
          max_covered_assets: input.maxCoveredAssets,
          covered_asset_ids: input.coveredAssetIds,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readBot(res, 'falha ao alterar o bot no motor de simulação')
    },
  }
}
