import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listMacroEvents } from '../../services/admin'
import { listAssets } from '../../services/market'
import { PainelAdmin } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ listMacroEvents: vi.fn() }))
vi.mock('../../services/market', () => ({ listAssets: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/', element: <PainelAdmin /> },
            { path: '/admin/eventos/novo', element: <div>tela de criação</div> },
            { path: '/mercado/ativos/:id', element: <div>detalhe do ativo</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('PainelAdmin (tela 10.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listAssets).mockResolvedValue({ assets: [] })
    })

    afterEach(() => vi.clearAllMocks())

    it('lista o histórico de eventos macro', async () => {
        vi.mocked(listMacroEvents).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Minério de ferro dispara no mercado internacional',
                    narrative: 'narrativa',
                    direction: 'positivo',
                    magnitude_band: 'moderado',
                    affects_price: true,
                    affects_fundamentals: true,
                    status: 'pendente',
                    triggered_on_day: 5,
                    duration_days: 2,
                    targets: [{ sector: 'Mineração' }],
                    created_at: '2026-08-30T14:05:00.000Z',
                },
            ],
            total_entries: 1,
        })

        renderPage()
        expect(await screen.findByText('Minério de ferro dispara no mercado internacional')).toBeInTheDocument()
    })

    it('estado vazio sem eventos disparados', async () => {
        vi.mocked(listMacroEvents).mockResolvedValue({ events: [], total_entries: 0 })
        renderPage()
        expect(await screen.findByText('Nenhum evento macro disparado ainda.')).toBeInTheDocument()
    })

    it('"Novo evento" navega pra 10.2', async () => {
        vi.mocked(listMacroEvents).mockResolvedValue({ events: [], total_entries: 0 })
        renderPage()

        await screen.findByText('Nenhum evento macro disparado ainda.')
        fireEvent.click(screen.getByRole('button', { name: 'Novo evento' }))

        expect(screen.getByText('tela de criação')).toBeInTheDocument()
    })

    it('busca a primeira página com o tamanho default de paginação', async () => {
        vi.mocked(listMacroEvents).mockResolvedValue({ events: [], total_entries: 0 })
        renderPage()
        await screen.findByText('Nenhum evento macro disparado ainda.')
        expect(listMacroEvents).toHaveBeenCalledWith('token', 20, 0)
    })

    it('erro ao carregar mostra mensagem, sem quebrar a tela', async () => {
        vi.mocked(listMacroEvents).mockRejectedValue(new Error('falha de rede'))
        renderPage()
        expect(await screen.findByText('Não foi possível carregar o histórico agora. Tente novamente em instantes.')).toBeInTheDocument()
    })
})
