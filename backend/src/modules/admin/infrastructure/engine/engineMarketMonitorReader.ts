import { AdminAssetNotFoundError } from '../../domain/errors'
import type {
  MarketMonitorReader,
  MonitorAsset,
  MonitorAssetDetail,
} from '../../application/ports/marketMonitorReader'

const REQUEST_TIMEOUT_MS = 4000

export function createEngineMarketMonitorReader(engineUrl: string): MarketMonitorReader {
  return {
    async listAssets() {
      const res = await fetch(`${engineUrl}/admin/market/assets`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(`falha ao listar o mercado no motor de simulação (status ${res.status})`)
      }
      return ((await res.json()) as { assets: MonitorAsset[] }).assets
    },

    async getAsset(assetId) {
      const res = await fetch(`${engineUrl}/admin/market/assets/${encodeURIComponent(assetId)}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.status === 404) {
        throw new AdminAssetNotFoundError('ativo não encontrado')
      }
      if (!res.ok) {
        throw new Error(
          `falha ao ler o detalhe do ativo no motor de simulação (status ${res.status})`,
        )
      }
      return (await res.json()) as MonitorAssetDetail
    },
  }
}
