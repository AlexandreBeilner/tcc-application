import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { triggerMacroEvent } from '../../services/admin'
import { listAssets } from '../../services/market'
import { CriarEventoMacro } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ triggerMacroEvent: vi.fn(), listMacroEvents: vi.fn() }))
vi.mock('../../services/market', () => ({ listAssets: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/admin/eventos/novo', element: <CriarEventoMacro /> },
            { path: '/admin/eventos', element: <div>tela do painel admin</div> },
        ],
        { initialEntries: ['/admin/eventos/novo'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

function selectOption(ariaLabel: string, optionLabel: string) {
    fireEvent.click(screen.getByRole('button', { name: ariaLabel }))
    fireEvent.click(screen.getByRole('option', { name: optionLabel }))
}

describe('CriarEventoMacro (tela 10.2)', () => {
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

    it('link "Eventos macro" volta pro histórico', () => {
        renderPage()
        fireEvent.click(screen.getByText('Eventos macro'))
        expect(screen.getByText('tela do painel admin')).toBeInTheDocument()
    })

    it('disparo confirmado com sucesso volta pro histórico', async () => {
        vi.mocked(triggerMacroEvent).mockResolvedValue({
            event: {
                id: 'e1',
                title: 'x',
                narrative: 'x',
                direction: 'positivo',
                magnitude_band: 'moderado',
                affects_price: true,
                affects_fundamentals: true,
                status: 'pendente',
                triggered_on_day: 1,
                duration_days: 2,
                targets: [{ sector: 'Mineração' }],
            },
        })

        renderPage()
        selectOption('Template', 'Minério de ferro dispara no mercado internacional')
        selectOption('Setor', 'Mineração')
        fireEvent.click(screen.getByRole('button', { name: 'Disparar agora' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Confirmar disparo' }))

        await waitFor(() => expect(screen.getByText('tela do painel admin')).toBeInTheDocument())
    })
})
