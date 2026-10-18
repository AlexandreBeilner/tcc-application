import { describe, expect, it } from 'vitest'
import { computeRetentionChartLayout, niceMax, RETENTION_CHART_WIDTH } from '.'

describe('niceMax', () => {
    it.each([
        [0, 1],
        [0.3, 0.5],
        [1, 1],
        [37, 50],
        [120, 200],
        [480, 500],
        [510, 1000],
    ])('teto de %s é %s', (value, expected) => {
        expect(niceMax(value)).toBe(expected)
    })
})

describe('computeRetentionChartLayout', () => {
    it('sem dado nenhum ou com menos de 2 dias não há gráfico', () => {
        expect(computeRetentionChartLayout(1, [{ key: 'a', values: [3] }])).toBeNull()
        expect(computeRetentionChartLayout(3, [{ key: 'a', values: [null, null, null] }])).toBeNull()
    })

    it('liga os valores reais em reta, sem suavizar: um vale no meio continua vale', () => {
        const layout = computeRetentionChartLayout(5, [{ key: 'a', values: [10, 40, 5, 40, 10] }])
        const points = layout?.series[0].segments[0] ?? []
        expect(points).toHaveLength(5)
        expect(points[0].x).toBe(0)
        expect(points[4].x).toBe(RETENTION_CHART_WIDTH)
        // y cresce para baixo: o vale (5) fica mais abaixo que os dois vizinhos.
        expect(points[2].y).toBeGreaterThan(points[1].y)
        expect(points[2].y).toBeGreaterThan(points[3].y)
        // Só os pontos reais entram no caminho: 5 comandos, nenhum ponto de curva interpolado.
        expect(layout?.series[0].linePath.match(/[ML]/g)).toHaveLength(5)
    })

    it('dia sem dado interrompe a linha em vez de cair a zero', () => {
        const layout = computeRetentionChartLayout(5, [{ key: 'a', values: [10, 20, null, 30, 15] }])
        expect(layout?.series[0].segments.map((s) => s.length)).toEqual([2, 2])
        expect(layout?.series[0].byIndex[2]).toBeNull()
        expect(layout?.series[0].linePath.match(/M/g)).toHaveLength(2)
    })

    it('o eixo parte de zero e usa um teto redondo comum a todas as séries', () => {
        const layout = computeRetentionChartLayout(3, [
            { key: 'a', values: [10, 20, 30] },
            { key: 'b', values: [5, 7, 480] },
        ])
        expect(layout?.maxValue).toBe(500)
        const [a, b] = layout?.series ?? []
        // Mesma escala: 30 numa série fica mais alto (menor y) que 7 na outra.
        expect(a.byIndex[2]?.y).toBeGreaterThan(b.byIndex[2]?.y as number)
        expect(b.byIndex[1]?.y).toBeGreaterThan(a.byIndex[0]?.y as number)
    })

    it('trecho de um dia só vira um segmento de um ponto (a tela desenha um marcador)', () => {
        const layout = computeRetentionChartLayout(3, [{ key: 'a', values: [null, 8, null] }])
        expect(layout?.series[0].segments).toHaveLength(1)
        expect(layout?.series[0].segments[0]).toHaveLength(1)
    })
})
