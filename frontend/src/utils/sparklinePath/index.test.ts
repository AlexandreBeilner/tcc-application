import { describe, expect, it } from 'vitest'
import { computeSparklineGeometry } from '.'

describe('computeSparklineGeometry', () => {
    it('menos de 2 pontos não desenha', () => {
        expect(computeSparklineGeometry([], 100, 30)).toBeNull()
        expect(computeSparklineGeometry([5], 100, 30)).toBeNull()
    })

    it('série em alta: começa embaixo, termina em cima e a direção é up', () => {
        const geometry = computeSparklineGeometry([10, 12, 14], 100, 30, 3)
        expect(geometry?.direction).toBe('up')
        expect(geometry?.linePath).toBe('M0.0,27.0 L50.0,15.0 L100.0,3.0')
    })

    it('série em queda tem direção down', () => {
        expect(computeSparklineGeometry([14, 12, 10], 100, 30)?.direction).toBe('down')
    })

    it('série constante vira linha no meio, direção flat', () => {
        const geometry = computeSparklineGeometry([7, 7, 7], 100, 30)
        expect(geometry?.direction).toBe('flat')
        expect(geometry?.linePath).toBe('M0.0,15.0 L50.0,15.0 L100.0,15.0')
    })

    it('ignora valores não finitos', () => {
        expect(computeSparklineGeometry([1, Number.NaN, 3], 100, 30)?.direction).toBe('up')
    })
})
