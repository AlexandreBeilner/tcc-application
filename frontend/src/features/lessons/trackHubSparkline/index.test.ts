import { describe, expect, it } from 'vitest'
import { computeTrackHubSparkline, TRACK_HUB_SPARKLINE_HEIGHT, TRACK_HUB_SPARKLINE_WIDTH } from './index'

describe('computeTrackHubSparkline', () => {
    it('é determinístico — mesma trackNumber e completionPct sempre produzem o mesmo desenho', () => {
        const a = computeTrackHubSparkline(2, 40)
        const b = computeTrackHubSparkline(2, 40)

        expect(a).toEqual(b)
    })

    it('trilhas diferentes produzem desenhos diferentes mesmo com o mesmo completionPct', () => {
        const a = computeTrackHubSparkline(0, 50)
        const b = computeTrackHubSparkline(1, 50)

        expect(a.linePath).not.toBe(b.linePath)
    })

    it('a linha começa em x=0 e termina em x=width (âncoras reais, sem ruído nas pontas)', () => {
        const { linePath } = computeTrackHubSparkline(3, 0)

        expect(linePath.startsWith('M0.0,')).toBe(true)
        expect(linePath).toContain(`L${TRACK_HUB_SPARKLINE_WIDTH.toFixed(1)},`)
    })

    it('fillPath fecha o caminho na base do viewBox', () => {
        const { fillPath } = computeTrackHubSparkline(1, 75)

        expect(fillPath.endsWith(`L0,${TRACK_HUB_SPARKLINE_HEIGHT} Z`)).toBe(true)
    })

    it('nunca desenha fora do viewBox (0-100%), mesmo com ruído somado às pontas do trecho concluído', () => {
        const { linePath } = computeTrackHubSparkline(2, 100)
        const ys = [...linePath.matchAll(/,(-?\d+\.\d)/g)].map((match) => Number(match[1]))

        expect(ys.every((y) => y >= 0 && y <= TRACK_HUB_SPARKLINE_HEIGHT)).toBe(true)
    })
})
