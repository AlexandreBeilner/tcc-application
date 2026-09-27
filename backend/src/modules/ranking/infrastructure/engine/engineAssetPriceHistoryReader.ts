import type { AssetPriceHistoryReader } from '../../application/ports/assetPriceHistoryReader'

interface QuotePoint {
  simulated_day: number
  price: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
// 1 dia real = 5 dias simulados (tarefa S.3, `.docs/engine/tick.md`); espelha
// `SIMULATION_DAYS_PER_REAL_DAY` do motor (padrão 5), não importado (serviços
// separados), só documentado aqui.
const SIMULATED_DAYS_PER_REAL_DAY = 5
// Folga sobre a janela mais larga usada pelo ranking (mês calendário, ~31
// dias reais = ~155 dias simulados).
const QUOTE_HISTORY_DAYS = 35 * SIMULATED_DAYS_PER_REAL_DAY
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

      // `cutoff` é uma data real; o motor só expõe `simulated_day` (sem data
      // real) em `GET /assets/:id/quotes` (4.6). Como 1 dia real = 5 dias
      // simulados (S.3), o dia simulado equivalente é o mais recente menos
      // `daysAgo * 5`, e o preço é o da última cotação até esse dia (fim de
      // semana simulado não tem cotação, então não dá pra indexar o array por
      // posição). Antes do primeiro dia disponível, cai na cotação mais antiga.
      const latestDay = quotes[quotes.length - 1].simulated_day
      const daysAgo = Math.max(Math.floor((Date.now() - cutoff.getTime()) / MS_PER_DAY), 0)
      const targetDay = latestDay - daysAgo * SIMULATED_DAYS_PER_REAL_DAY
      let chosen = quotes[0]
      for (const quote of quotes) {
        if (quote.simulated_day <= targetDay) chosen = quote
      }
      return chosen.price
    },
  }
}
