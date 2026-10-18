import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getLessonCardFunnel } from '../../services/admin'
import type { LessonCardFunnel } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminConteudoFunil } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ getLessonCardFunnel: vi.fn() }))

const funnel: LessonCardFunnel = {
    lesson: { id: 'l1', code: '0.1', title: 'O que é investir' },
    days: 30,
    since: '2026-09-19',
    bars: [
        { phase: 0, card_index: 0, reached: 10, lost: 0, lost_rate: null },
        { phase: 0, card_index: 1, reached: 4, lost: 6, lost_rate: 0.6 },
        { phase: 3, card_index: 0, reached: 3, lost: 1, lost_rate: 0.25 },
    ],
    biggest_drop: { phase: 0, card_index: 1 },
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin/conteudo/l1/funil']}>
                <Routes>
                    <Route path="/admin/conteudo/:id/funil" element={<AdminConteudoFunil />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as unknown as ReturnType<typeof useAuth>)
})

describe('AdminConteudoFunil', () => {
    it('lista os cartões na ordem, destaca a maior queda com selo de texto e mostra o resumo', async () => {
        vi.mocked(getLessonCardFunnel).mockResolvedValue(funnel)
        renderPage()

        const list = await screen.findByRole('list', { name: 'Cartões da lição' })
        const rows = within(list).getAllByRole('listitem')
        expect(rows.map((row) => row.textContent)).toEqual([
            expect.stringContaining('Cenário · cartão 1'),
            expect.stringContaining('Cenário · cartão 2'),
            expect.stringContaining('Tela final'),
        ])
        expect(within(rows[1] as HTMLElement).getByText('Maior queda')).toBeInTheDocument()
        expect(within(rows[0] as HTMLElement).queryByText('Maior queda')).toBeNull()
        expect(rows[1]).toHaveTextContent('4 pessoas')
        expect(rows[1]).toHaveTextContent('-6, 60%')
        expect(screen.getByRole('heading', { name: /0\.1 · O que é investir/ })).toBeInTheDocument()
        expect(screen.getByText(/10 chegaram ao primeiro cartão e 3 ao último medido/)).toBeInTheDocument()
        expect(getLessonCardFunnel).toHaveBeenCalledWith('tok', 'l1', 30)
    })

    it('trocar a janela refaz a consulta com os dias escolhidos', async () => {
        vi.mocked(getLessonCardFunnel).mockResolvedValue(funnel)
        renderPage()
        await screen.findByRole('list', { name: 'Cartões da lição' })

        fireEvent.click(screen.getByRole('button', { name: '7 dias' }))

        await waitFor(() => expect(getLessonCardFunnel).toHaveBeenCalledWith('tok', 'l1', 7))
        expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('avisa quando nada foi medido na janela', async () => {
        vi.mocked(getLessonCardFunnel).mockResolvedValue({ ...funnel, bars: [], biggest_drop: null })
        renderPage()

        expect(await screen.findByText('Nada medido ainda nesta janela.')).toBeInTheDocument()
    })

    it('mostra erro quando a lição não existe', async () => {
        vi.mocked(getLessonCardFunnel).mockRejectedValue(new ApiError(404, 'lição não encontrada'))
        renderPage()

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o funil')
    })
})
