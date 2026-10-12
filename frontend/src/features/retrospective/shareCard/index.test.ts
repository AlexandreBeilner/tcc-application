import { describe, expect, it, vi } from 'vitest'
import type { Retrospective } from '../../../services/retrospectives'
import { buildShareText, drawShareCard, monthLabel, shareOrDownload, type CanvasLike } from '.'

const base: Retrospective = {
    month: '2026-09',
    full: true,
    lessonsCompleted: 6,
    achievementsUnlocked: 2,
    achievementNames: ['Primeira Semana', 'Estudioso'],
    level: 5,
    premium: {
        activeDays: [1, 2, 3, 9],
        daysInMonth: 30,
        longestStreak: 3,
        bestReturnPct: 4.2,
        duelsPlayed: 2,
        duelsWon: 1,
        leaguesActive: 1,
    },
    empty: false,
}

describe('texto de compartilhar', () => {
    it('nome do mês em português', () => {
        expect(monthLabel('2026-09')).toBe('setembro de 2026')
        expect(monthLabel('2026-03')).toBe('março de 2026')
    })

    it('PRO destaca a sequência; sem PRO destaca as lições; nunca valor em reais', () => {
        expect(buildShareText(base)).toBe('Meu setembro no Selucra: 3 dias seguidos, 6 lições, nível 5.')
        expect(buildShareText({ ...base, full: false, premium: null })).toBe('Meu setembro no Selucra: 6 lições, nível 5.')
        expect(buildShareText(base)).not.toMatch(/R\$/)
    })

    it('singular de 1 dia e 1 lição', () => {
        const one = { ...base, lessonsCompleted: 1, premium: { ...base.premium!, longestStreak: 1 } }
        expect(buildShareText(one)).toContain('1 dia seguido, 1 lição')
    })
})

// Contexto 2D de mentira que só registra o texto desenhado.
function fakeCanvas() {
    const texts: string[] = []
    const gradient = { addColorStop: vi.fn() }
    const ctx = {
        fillRect: vi.fn(),
        createLinearGradient: vi.fn(() => gradient),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        roundRect: vi.fn(),
        measureText: vi.fn(() => ({ width: 200 })),
        fillText: vi.fn((text: string) => texts.push(text)),
    } as unknown as CanvasRenderingContext2D
    const canvas: CanvasLike = { width: 0, height: 0, getContext: () => ctx }
    return { canvas, texts }
}

describe('drawShareCard', () => {
    it('versão PRO desenha sequência, marcos em percentual, selo e título, sem reais', () => {
        const { canvas, texts } = fakeCanvas()
        drawShareCard(canvas, base, { username: 'ana', isPro: true, frame: 'frame_aurora', title: 'Estrategista' })

        expect(canvas.width).toBe(1080)
        expect(texts).toContain('3')
        expect(texts).toContain('dias seguidos')
        expect(texts).toContain('PRO')
        expect(texts).toContain('Estrategista')
        expect(texts).toContain('+4,2% no mês')
        expect(texts).toContain('1 duelo vencido')
        expect(texts.join(' ')).not.toMatch(/R\$/)
    })

    it('versão simples desenha lições e as métricas básicas, sem selo nem percentual', () => {
        const { canvas, texts } = fakeCanvas()
        drawShareCard(canvas, { ...base, full: false, premium: null }, { username: 'ana', isPro: false, frame: null, title: null })

        expect(texts).toContain('6')
        expect(texts).toContain('lições concluídas')
        expect(texts).toContain('Nível 5')
        expect(texts).not.toContain('PRO')
        expect(texts.join(' ')).not.toMatch(/%/)
    })

    it('rentabilidade negativa leva o sinal de menos', () => {
        const { canvas, texts } = fakeCanvas()
        drawShareCard(
            canvas,
            { ...base, premium: { ...base.premium!, bestReturnPct: -2.5 } },
            { username: 'ana', isPro: true, frame: null, title: null },
        )
        expect(texts).toContain('−2,5% no mês')
    })

    it('sem contexto 2D não quebra', () => {
        expect(() =>
            drawShareCard({ width: 0, height: 0, getContext: () => null }, base, { username: 'a', isPro: false, frame: null, title: null }),
        ).not.toThrow()
    })
})

describe('shareOrDownload', () => {
    const blob = new Blob(['x'], { type: 'image/png' })

    it('usa o menu de compartilhar quando o aparelho suporta arquivos', async () => {
        const share = vi.fn().mockResolvedValue(undefined)
        Object.assign(navigator, { canShare: () => true, share })
        expect(await shareOrDownload(blob, 'texto', 'a.png')).toBe('shared')
        expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: 'texto' }))
    })

    it('fechar o menu de compartilhar não é erro', async () => {
        Object.assign(navigator, {
            canShare: () => true,
            share: vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError')),
        })
        expect(await shareOrDownload(blob, 't', 'a.png')).toBe('cancelled')
    })

    it('sem suporte baixa o PNG', async () => {
        Object.assign(navigator, { canShare: undefined, share: undefined })
        URL.createObjectURL = vi.fn(() => 'blob:x')
        URL.revokeObjectURL = vi.fn()
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
        expect(await shareOrDownload(blob, 't', 'a.png')).toBe('downloaded')
        expect(click).toHaveBeenCalled()
    })
})
