import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEstimateCard, buildEstimateMessage, buildScoreCard, buildScoreMessage, drawResultCard, shareResult, withInviteLink } from '.'

describe('textos de compartilhar (LJ.5.10)', () => {
    it('placar: "N de M de primeira", ou só a conclusão quando a lição não tem pergunta', () => {
        expect(buildScoreMessage({ lessonTitle: 'Inflação', firstTry: 5, total: 5 })).toBe(
            'Fiz a lição "Inflação" no Selucra: 5 de 5 de primeira.',
        )
        expect(buildScoreMessage({ lessonTitle: 'Inflação', firstTry: 0, total: 0 })).toBe('Concluí a lição "Inflação" no Selucra.')
    })

    it('estimativa: o chute e o valor real, formatados pela unidade', () => {
        expect(buildEstimateMessage({ guess: 3100, value: 6727.5, unit: 'brl' })).toMatch(/^Chutei R\$\s3\.100\. Era R\$\s6\.727,50\./)
        expect(buildEstimateMessage({ guess: 7, value: 5.5, unit: 'pct' })).toContain('Chutei 7%. Era 5,5%.')
    })

    it('o link de convite vai no fim e nenhum texto leva valor de patrimônio', () => {
        const text = withInviteLink(buildScoreMessage({ lessonTitle: 'X', firstTry: 1, total: 2 }), 'https://app/login?ref=ABCD2345')
        expect(text.endsWith(' https://app/login?ref=ABCD2345')).toBe(true)
        expect(text).not.toMatch(/patrim|rentabilidade|posição/i)
    })

    it('cartões: placar e estimativa', () => {
        expect(buildScoreCard({ lessonTitle: 'L', firstTry: 4, total: 5 })).toEqual({
            lessonTitle: 'L',
            headline: '4 de 5',
            caption: 'de primeira',
        })
        expect(buildScoreCard({ lessonTitle: 'L', firstTry: 0, total: 0 }).headline).toBe('Lição')
        const card = buildEstimateCard('L', { guess: 3100, value: 6727.5, unit: 'brl' })
        expect(card.caption).toBe('foi o meu chute')
        expect(card.footnote).toMatch(/^Era R\$/)
    })
})

describe('drawResultCard', () => {
    it('desenha o título, o destaque e a legenda no canvas', () => {
        const texts: string[] = []
        const ctx = new Proxy(
            {
                measureText: () => ({ width: 100 }),
                createLinearGradient: () => ({ addColorStop: () => {} }),
                fillText: (t: string) => texts.push(t),
            },
            { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}), set: () => true },
        )
        const canvas = { width: 0, height: 0, getContext: () => ctx as unknown as CanvasRenderingContext2D }

        drawResultCard(canvas, { lessonTitle: 'Juros compostos', headline: '4 de 5', caption: 'de primeira', footnote: 'Era R$ 1' })

        expect(canvas.width).toBe(1080)
        expect(texts).toEqual(expect.arrayContaining(['Selucra', 'Juros compostos', '4 de 5', 'de primeira', 'Era R$ 1']))
    })

    it('sem contexto 2d não quebra', () => {
        expect(() =>
            drawResultCard({ width: 0, height: 0, getContext: () => null }, { lessonTitle: 'L', headline: 'h', caption: 'c' }),
        ).not.toThrow()
    })
})

describe('shareResult', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    })

    it('usa o menu do sistema quando existe', async () => {
        const share = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'share', { value: share, configurable: true })

        expect(await shareResult('texto', null)).toBe('shared')
        expect(share).toHaveBeenCalledWith({ text: 'texto' })
    })

    it('fechar o menu é cancelar, e outra falha cai na cópia do texto', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        Object.defineProperty(navigator, 'share', {
            value: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')),
            configurable: true,
        })
        expect(await shareResult('texto', null)).toBe('cancelled')

        Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new Error('boom')), configurable: true })
        expect(await shareResult('texto', null)).toBe('copied')
        expect(writeText).toHaveBeenCalledWith('texto')
    })

    it('sem navigator.share copia o texto; sem área de transferência, falha avisando', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        expect(await shareResult('texto', null)).toBe('copied')

        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockRejectedValue(new Error('x')) },
            configurable: true,
        })
        expect(await shareResult('texto', null)).toBe('failed')
    })
})
