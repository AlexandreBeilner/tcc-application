import { describe, expect, it } from 'vitest'
import { computePodiumSparkline, PODIUM_SPARKLINE_HEIGHT, PODIUM_SPARKLINE_WIDTH } from './index'

describe('computePodiumSparkline', () => {
    it('é determinístico — mesma seedKey e endPct sempre produzem o mesmo desenho', () => {
        const a = computePodiumSparkline('u1:overall', 12.5)
        const b = computePodiumSparkline('u1:overall', 12.5)

        expect(a).toEqual(b)
    })

    it('seedKeys diferentes produzem desenhos diferentes mesmo com o mesmo endPct', () => {
        const a = computePodiumSparkline('u1:overall', 10)
        const b = computePodiumSparkline('u2:overall', 10)

        expect(a.linePath).not.toBe(b.linePath)
    })

    it('a linha começa em x=0 e termina em x=width (âncoras reais, sem ruído nas pontas)', () => {
        const { linePath } = computePodiumSparkline('u1:overall', -8)

        expect(linePath.startsWith('M0.0,')).toBe(true)
        expect(linePath).toContain(`L${PODIUM_SPARKLINE_WIDTH.toFixed(1)},`)
    })

    it('fillPath fecha o caminho na base do viewBox', () => {
        const { fillPath } = computePodiumSparkline('u1:overall', 5)

        expect(fillPath.endsWith(`L0,${PODIUM_SPARKLINE_HEIGHT} Z`)).toBe(true)
    })
})
