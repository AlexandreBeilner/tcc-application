import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { useLessonsQuery } from '../../../features/lessons/useLessonsQuery'
import { RewardRevealProvider } from '../../../features/shell/RewardRevealProvider'
import { DiarioGame } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../features/lessons/useLessonsQuery', () => ({ useLessonsQuery: vi.fn() }))

const lessonsData = (lessons: object[]) => ({ data: { lessons } }) as unknown as ReturnType<typeof useLessonsQuery>

const game = {
    number: 4,
    date: '2026-10-17',
    isToday: true,
    nextGameAt: '2026-10-18T00:00:00.000Z',
    cards: {
        word: { length: 5, maxAttempts: 6 },
        trivia: { question: 'Qual órgão decide a Selic?', options: ['Tesouro', 'Copom'] },
        timeline: {
            events: [
                { id: 'a', label: 'Plano Real' },
                { id: 'b', label: 'Plano Collor' },
            ],
        },
    },
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface Call {
    url: string
    auth: string | null
}

function stubFetch(timelineCompletion: object | undefined, missionStatus: 'pending' | 'completed' | null = null) {
    const calls: Call[] = []
    const impl = async (input: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        calls.push({ url: input, auth: headers.get('Authorization') })
        if (input.endsWith('/daily/today')) return json({ status: 'live', game })
        if (input.endsWith('/word/guess'))
            return json({
                letters: ['correct', 'correct', 'correct', 'correct', 'correct'],
                solved: true,
                attempt: 1,
                finished: true,
                reveal: { answer: 'JUROS', definition: 'Preço do dinheiro no tempo.', learnMore: null },
            })
        if (input.endsWith('/trivia/answer'))
            return json({ correct: true, correctIndex: 1, explanation: 'O Copom.', sourceRef: 'bcb.gov.br', learnMore: null })
        if (input.endsWith('/timeline/answer'))
            return json({
                correct: true,
                positionHits: [true, true],
                events: [
                    { id: 'b', label: 'Plano Collor', year: 1990, explanation: 'x', sourceRef: 's', learnMore: null },
                    { id: 'a', label: 'Plano Real', year: 1994, explanation: 'y', sourceRef: 's', learnMore: null },
                ],
                ...(timelineCompletion ? { completion: timelineCompletion } : {}),
            })
        if (input.endsWith('/missions'))
            return json({
                missions: missionStatus
                    ? [
                          { id: 'm9', key: 'feed_read', status: 'pending' },
                          { id: 'm5', key: 'play_daily', status: missionStatus },
                      ]
                    : [],
            })
        if (input.endsWith('/missions/m5/complete'))
            return json({
                status: 'completed',
                xpAwarded: 20,
                leveledUp: false,
                newLevel: 2,
                streakMilestone: null,
                unlockedAchievements: [],
            })
        if (input.includes('/me/stats'))
            return json({ games: 0, streak: 0, bestStreak: 0, wordWins: 0, wordPlayed: 0, distribution: [0, 0, 0, 0, 0, 0] })
        return json({})
    }
    vi.stubGlobal('fetch', impl)
    return calls
}

async function playAll() {
    await screen.findByText('Diário Selucra', { selector: '.dg-title, .dg h2, .dg *' }).catch(() => undefined)
    await waitFor(() => expect(document.querySelectorAll('.dg-row')).toHaveLength(6))
    for (const ch of 'JUROS') fireEvent.keyDown(document, { key: ch })
    fireEvent.keyDown(document, { key: 'Enter' })
    await waitFor(() => expect(document.querySelectorAll('.dg-tab')[0].textContent).toMatch(/certo/), { timeout: 4000 })
    fireEvent.click(document.querySelectorAll('.dg-tab')[1])
    fireEvent.click(document.querySelectorAll('.dg-option')[1])
    fireEvent.click(screen.getByText('Confirmar resposta'))
    await waitFor(() => expect(document.querySelectorAll('.dg-tab')[1].textContent).toMatch(/certo/), { timeout: 4000 })
    fireEvent.click(document.querySelectorAll('.dg-tab')[2])
    fireEvent.click(screen.getByText('Conferir ordem'))
}

function renderGame() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/diario']}>
                <RewardRevealProvider>
                    <Routes>
                        <Route path="/diario" element={<DiarioGame />} />
                        <Route path="/glossario" element={<p>pagina do glossario</p>} />
                    </Routes>
                </RewardRevealProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    )
    return { invalidate }
}

describe('DiarioGame (DI.4.1)', () => {
    const logout = vi.fn()
    beforeEach(() => {
        vi.mocked(useLessonsQuery).mockReturnValue(lessonsData([]))
        vi.mocked(useAuth).mockReturnValue({ token: 'tok-123', user: { id: 'u1' }, logout } as unknown as ReturnType<typeof useAuth>)
        window.matchMedia = ((q: string) => ({
            matches: q.includes('reduce'),
            media: q,
            addEventListener() {},
            removeEventListener() {},
        })) as never
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        logout.mockClear()
    })

    it('monta o jogo em modo app: manda o token, não usa localStorage e não oferece "importar"', async () => {
        const calls = stubFetch(undefined)
        const spy = vi.spyOn(Storage.prototype, 'setItem')
        renderGame()
        await waitFor(() => expect(document.querySelectorAll('.dg-row')).toHaveLength(6))
        const today = calls.find((c) => c.url.endsWith('/daily/today'))
        expect(today?.auth).toBe('Bearer tok-123')
        expect(calls.some((c) => c.url.includes('/daily/4/me'))).toBe(true)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })

    it('ao fechar o jogo do dia mostra o XP uma vez e atualiza a gamificação', async () => {
        stubFetch({ correctCards: 3, xpAwarded: 50, level: 2, leveledUp: false, streakMilestone: null, unlockedAchievements: [] })
        const { invalidate } = renderGame()
        await playAll()
        expect(await screen.findByText('+50 XP', { selector: '[role="status"] *' }, { timeout: 4000 })).toBeTruthy()
        expect(screen.getAllByText('+50 XP').filter((el) => el.closest('[role="status"]') && el.tagName === 'P')).toHaveLength(1)
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['gamification'] })
    })

    it('conclui a missão "Jogue o Diário" ao fechar o jogo do dia e mostra o XP dela depois do do Diário', async () => {
        const calls = stubFetch({ correctCards: 3, xpAwarded: 50, level: 2, leveledUp: false, unlockedAchievements: [] }, 'pending')
        renderGame()
        await playAll()
        await waitFor(() => expect(calls.some((c) => c.url.endsWith('/missions/m5/complete'))).toBe(true), { timeout: 4000 })
        expect(calls.some((c) => c.url.endsWith('/missions/m9/complete'))).toBe(false)
        expect(await screen.findByText('+50 XP', { selector: '[role="status"] *' }, { timeout: 4000 })).toBeTruthy()
    })

    it('missão do Diário já concluída hoje não é enviada de novo', async () => {
        const calls = stubFetch({ correctCards: 3, xpAwarded: 50, level: 2, leveledUp: false, unlockedAchievements: [] }, 'completed')
        renderGame()
        await playAll()
        await waitFor(() => expect(calls.some((c) => c.url.endsWith('/missions'))).toBe(true), { timeout: 4000 })
        await act(async () => {})
        expect(calls.some((c) => c.url.includes('/complete'))).toBe(false)
    })

    it('dia anterior (xpAwarded 0) nem consulta as missões', async () => {
        const calls = stubFetch({ correctCards: 3, xpAwarded: 0 }, 'pending')
        renderGame()
        await playAll()
        await waitFor(() => expect(document.querySelector('.dg-result')?.childElementCount).toBeGreaterThan(0), { timeout: 4000 })
        await act(async () => {})
        expect(calls.some((c) => c.url.endsWith('/missions'))).toBe(false)
    })

    it('nível, conquista e marco de streak entram na fila de recompensa', async () => {
        stubFetch({
            correctCards: 3,
            xpAwarded: 50,
            level: 5,
            leveledUp: true,
            streakMilestone: 7,
            unlockedAchievements: [{ id: 'x', name: 'Jogador diário', description: 'Fechou o Diário' }],
        })
        renderGame()
        await playAll()
        expect(await screen.findByText('Você subiu de nível!', {}, { timeout: 4000 })).toBeTruthy()
    })

    it('dia anterior ou jogo fora da janela (xpAwarded 0) não dispara teatro de recompensa', async () => {
        stubFetch({ correctCards: 3, xpAwarded: 0 })
        const { invalidate } = renderGame()
        await playAll()
        await waitFor(() => expect(document.querySelector('.dg-result')?.childElementCount).toBeGreaterThan(0), { timeout: 4000 })
        await act(async () => {})
        expect(screen.queryByText(/\+\d+ XP/, { selector: 'p' })).toBeNull()
        expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['gamification'] })
    })

    it('token inválido (401) sai da sessão', async () => {
        vi.stubGlobal('fetch', async (input: string) =>
            input.endsWith('/daily/today') ? json({ status: 'live', game }) : json({ error: 'x' }, 401),
        )
        renderGame()
        await waitFor(() => expect(logout).toHaveBeenCalled())
    })
    it('próximo passo: depois do último cartão oferece a próxima lição disponível, nunca uma bloqueada', async () => {
        vi.mocked(useLessonsQuery).mockReturnValue(
            lessonsData([
                { id: 'l0', status: 'completed', currentStep: 0, title: 'Feita', code: '1.1' },
                { id: 'l1', status: 'available', currentStep: 2, title: 'Juros compostos', code: '1.2' },
                { id: 'l2', status: 'locked', currentStep: 0, title: 'Bloqueada', code: '1.3' },
            ]),
        )
        stubFetch({ correctCards: 3, xpAwarded: 50 })
        renderGame()
        expect(screen.queryByLabelText('Próximo passo')).toBeNull()
        await playAll()
        const next = await screen.findByLabelText('Próximo passo', {}, { timeout: 4000 })
        expect(next.querySelector('a')?.getAttribute('href')).toBe('/trilha/l1')
        expect(next.textContent).toContain('Retomar a lição: Juros compostos')
    })

    it('próximo passo sem lição disponível leva ao mercado', async () => {
        stubFetch({ correctCards: 3, xpAwarded: 50 })
        renderGame()
        await playAll()
        const next = await screen.findByLabelText('Próximo passo', {}, { timeout: 4000 })
        expect(next.querySelector('a')?.getAttribute('href')).toBe('/mercado')
    })

    it('"Saiba mais" do glossário navega pelo roteador, sem recarregar a página', async () => {
        stubFetch({ correctCards: 3, xpAwarded: 50 })
        renderGame()
        await playAll()
        await waitFor(() => expect(document.querySelector('.dg-result')?.childElementCount).toBeGreaterThan(0), { timeout: 4000 })
        const host = document.querySelector('.dg') as HTMLElement
        const a = document.createElement('a')
        a.href = '/glossario?termo=Selic'
        a.setAttribute('href', '/glossario?termo=Selic')
        host.appendChild(a)
        fireEvent.click(a)
        expect(await screen.findByText('pagina do glossario')).toBeTruthy()
    })
})
