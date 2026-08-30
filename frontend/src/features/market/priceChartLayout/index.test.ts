import { describe, expect, it } from 'vitest'
import { computePriceChartLayout, PRICE_CHART_HEIGHT, PRICE_CHART_WIDTH } from '.'

describe('features/market/priceChartLayout', () => {
    it('devolve null com menos de 2 cotações', () => {
        expect(computePriceChartLayout([])).toBeNull()
        expect(computePriceChartLayout([{ simulated_day: 1, price: 10 }])).toBeNull()
    })

    it('primeiro e último ponto ficam nas bordas do viewBox', () => {
        const layout = computePriceChartLayout([
            { simulated_day: 1, price: 10 },
            { simulated_day: 2, price: 12 },
            { simulated_day: 3, price: 11 },
        ])!

        expect(layout.points[0].x).toBe(0)
        expect(layout.points[layout.points.length - 1].x).toBe(PRICE_CHART_WIDTH)
        expect(layout.points.every((p) => p.y >= 0 && p.y <= PRICE_CHART_HEIGHT)).toBe(true)
    })

    it('isGain é true quando o preço final é maior ou igual ao inicial', () => {
        expect(
            computePriceChartLayout([
                { simulated_day: 1, price: 10 },
                { simulated_day: 2, price: 15 },
            ])!.isGain,
        ).toBe(true)
        expect(
            computePriceChartLayout([
                { simulated_day: 1, price: 10 },
                { simulated_day: 2, price: 10 },
            ])!.isGain,
        ).toBe(true)
        expect(
            computePriceChartLayout([
                { simulated_day: 1, price: 10 },
                { simulated_day: 2, price: 5 },
            ])!.isGain,
        ).toBe(false)
    })

    it('minPrice/maxPrice refletem o range real das cotações', () => {
        const layout = computePriceChartLayout([
            { simulated_day: 1, price: 8 },
            { simulated_day: 2, price: 20 },
            { simulated_day: 3, price: 3 },
        ])!

        expect(layout.minPrice).toBe(3)
        expect(layout.maxPrice).toBe(20)
    })
})
