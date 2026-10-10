import type { AssetTypeLookup } from '../../application/ports/assetTypeLookup'

const REQUEST_TIMEOUT_MS = 4000

interface EngineAsset {
  ticker: string
  type: string
}

// Catálogo do motor (`GET /assets`, o mesmo que o mercado do jogador lê). Lista inteira por consulta:
// a validação de uma lição acontece raramente (edição de admin), então não vale cache, e um cache
// obsoleto aceitaria ticker recém-removido.
export function createEngineAssetTypeLookup(engineUrl: string): AssetTypeLookup {
  return {
    async typeOfTicker(ticker) {
      const res = await fetch(`${engineUrl}/assets`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(
          `falha ao consultar o catálogo de ativos no motor de simulação (status ${res.status})`,
        )
      }
      const assets = (await res.json()) as EngineAsset[]
      return assets.find((asset) => asset.ticker === ticker)?.type
    },
  }
}
