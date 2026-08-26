import type { AssetPriceHistoryReader } from '../../application/ports/assetPriceHistoryReader'

interface QuotePoint {
  simulated_day: number
  price: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
// Folga sobre a janela mais larga usada pelo ranking (mês calendário, ~31
// dias).
const QUOTE_HISTORY_DAYS = 35
// Preço de referência quando o ativo nunca teve cotação gerada — espelha
// `tick.DefaultInitialPrice` do motor (`.docs/engine/tick.md`); não
// importado (TS/Go, serviços separados), só documentado aqui pra não
// divergir sem querer se um dos dois lados mudar.
const DEFAULT_ASSET_PRICE_FALLBACK = 100.0

export function createEngineAssetPriceHistoryReader(engineUrl: string): AssetPriceHistoryReader {
  return {
    async priceAsOf(assetId: string, cutoff: Date): Promise<number> {
      const res = await fetch(`${engineUrl}/assets/${assetId}/quotes?days=${QUOTE_HISTORY_DAYS}`)
      if (!res.ok) {
        throw new Error(
          `falha ao ler histórico de cotação no motor de simulação (status ${res.status})`,
        )
      }

      const quotes = (await res.json()) as QuotePoint[]
      if (quotes.length === 0) {
        return DEFAULT_ASSET_PRICE_FALLBACK
      }

      // Aproximação documentada, não confirmada com o usuário: o motor só
      // expõe `simulated_day` (sem data real) em `GET /assets/:id/quotes`
      // (4.6) — sem tocar o motor de novo (premissa da semana 4), mapeamos
      // `cutoff` (data real) pro índice do array assumindo 1 tick = 1 dia
      // real (design do Temporizador — ver memória
      // "timer-orchestrator-decision"), contando pra trás a partir do
      // último elemento (o mais recente = "hoje"). Ticks manuais
      // (`POST /admin/tick`, usados em demo) quebram essa suposição —
      // sinalizar se isso causar imprecisão perceptível na prática.
      const daysAgo = Math.floor((Date.now() - cutoff.getTime()) / MS_PER_DAY)
      const index = Math.min(Math.max(quotes.length - 1 - daysAgo, 0), quotes.length - 1)
      return quotes[index].price
    },
  }
}
