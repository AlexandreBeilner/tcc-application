import type {
  MarketOverview,
  MarketOverviewReader,
} from '../../application/ports/marketOverviewReader'

const REQUEST_TIMEOUT_MS = 3000

export function createEngineMarketOverviewReader(engineUrl: string): MarketOverviewReader {
  return {
    async get() {
      const res = await fetch(`${engineUrl}/admin/overview`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(
          `falha ao ler a visão geral do mercado no motor de simulação (status ${res.status})`,
        )
      }
      return (await res.json()) as MarketOverview
    },
  }
}
