import { describe, expect, it } from 'vitest'
import { createDailyApi, createLocalKeeper, mountDiario } from './index.ts'
import type { DailyGame } from './index.ts'

// Guarda de integração: o frontend consegue importar, compilar (tsc) e montar o módulo que mora na landing.
const game: DailyGame = {
    number: 1,
    date: '2026-12-17',
    isToday: true,
    nextGameAt: '2026-12-18T00:00:00.000Z',
    cards: {
        word: { length: 5, maxAttempts: 6 },
        trivia: { question: 'Pergunta?', options: ['A', 'B'] },
    },
}

describe('módulo do Diário (landing/src/diario)', () => {
    it('monta o jogo em modo app dentro do jsdom do frontend', async () => {
        const fetchStub = (async (url: string) =>
            new Response(JSON.stringify(url.endsWith('/daily/today') ? { status: 'live', game } : {}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })) as unknown as typeof fetch
        const api = createDailyApi({ baseUrl: 'http://api.test', fetch: fetchStub })
        const root = document.createElement('div')
        document.body.appendChild(root)
        const controller = mountDiario(root, {
            api,
            mode: 'publico',
            keeper: createLocalKeeper({ getStorage: () => null }),
            reducedMotion: () => true,
        })
        await new Promise((r) => setTimeout(r, 10))
        expect(root.querySelectorAll('.dg-row')).toHaveLength(6)
        controller.destroy()
        expect(root.childElementCount).toBe(0)
    })
})
