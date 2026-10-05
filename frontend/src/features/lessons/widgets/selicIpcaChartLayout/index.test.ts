import { describe, expect, it } from 'vitest'
import { computeSelicIpcaChartLayout, SELIC_IPCA_CHART_HEIGHT } from '.'

const entries = [
    { simulatedDay: 1, selicPct: 10, ipcaPct: 5 },
    { simulatedDay: 2, selicPct: 12, ipcaPct: 4 },
    { simulatedDay: 3, selicPct: 11, ipcaPct: 3 },
]

describe('computeSelicIpcaChartLayout', () => {
    it('menos de dois pontos não desenha', () => {
        expect(computeSelicIpcaChartLayout(entries.slice(0, 1))).toBeNull()
    })

    it('faixa da meta fica dentro do gráfico e a meta no meio dela', () => {
        const layout = computeSelicIpcaChartLayout(entries)!
        expect(layout.bandTop).toBeGreaterThanOrEqual(0)
        expect(layout.bandTop + layout.bandHeight).toBeLessThanOrEqual(SELIC_IPCA_CHART_HEIGHT)
        expect(layout.targetY).toBeCloseTo(layout.bandTop + layout.bandHeight / 2, 6)
    })

    it('a Selic (maior valor) fica acima do IPCA e o domínio inclui a faixa', () => {
        const layout = computeSelicIpcaChartLayout(entries)!
        expect(layout.maxValue).toBe(12)
        expect(layout.minValue).toBe(1.5)
        expect(layout.selicPath.startsWith('M0.0,')).toBe(true)
    })

    it('série baixa ainda mostra a faixa inteira', () => {
        const layout = computeSelicIpcaChartLayout([
            { simulatedDay: 1, selicPct: 3, ipcaPct: 3 },
            { simulatedDay: 2, selicPct: 3, ipcaPct: 3 },
        ])!
        expect(layout.bandHeight).toBeGreaterThan(0)
    })
})
