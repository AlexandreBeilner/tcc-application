import type { QuoteHistoryEntry } from '../../../services/market'
import type { PriceChartLayout } from './types'

export type { PriceChartLayout, PriceChartPoint } from './types'

// Unidades virtuais do sparkline de preço (tela 4.5) — mesma convenção de
// `features/lessons/trackChartLayout`: o componente escala isso pra 100%
// do container via viewBox, então o mesmo layout serve pro card estreito
// do mobile e pro card largo do desktop (identidade-visual-padroes.md §7).
export const PRICE_CHART_WIDTH = 1000
export const PRICE_CHART_HEIGHT = 400

const MARGIN_Y = PRICE_CHART_HEIGHT * 0.1

// Diferente do gráfico de progressão da Trilha (marcos futuros/projetados,
// ruído sintético), cotação histórica é dado real do passado inteiro —
// nunca tem trecho tracejado/projetado (identidade-visual-padroes.md §3:
// sólido = já aconteceu).
export function computePriceChartLayout(quotes: QuoteHistoryEntry[]): PriceChartLayout | null {
    if (quotes.length < 2) return null

    const prices = quotes.map((q) => q.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const range = maxPrice - minPrice || 1
    const usableH = PRICE_CHART_HEIGHT - 2 * MARGIN_Y

    const points = quotes.map((quote, index) => {
        const x = quotes.length === 1 ? 0 : (index / (quotes.length - 1)) * PRICE_CHART_WIDTH
        const y = MARGIN_Y + usableH - ((quote.price - minPrice) / range) * usableH
        return { x, y, price: quote.price, simulatedDay: quote.simulated_day }
    })

    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]
    const fillPath = `${linePath} L${lastPoint.x.toFixed(1)},${PRICE_CHART_HEIGHT} L${firstPoint.x.toFixed(1)},${PRICE_CHART_HEIGHT} Z`

    return {
        points,
        linePath,
        fillPath,
        minPrice,
        maxPrice,
        isGain: prices[prices.length - 1] >= prices[0],
    }
}
