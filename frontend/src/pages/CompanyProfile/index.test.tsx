import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getCompany } from '../../services/market'
import { CompanyProfile } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ getCompany: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/mercado/empresas/:id', element: <CompanyProfile /> },
            { path: '/mercado/ativos/:id', element: <div>tela de ativo</div> },
        ],
        { initialEntries: ['/mercado/empresas/c1'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('CompanyProfile (tela 4.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra nome, setor, cnpj e navega pro ativo emitido ao clicar', async () => {
        vi.mocked(getCompany).mockResolvedValue({
            company: {
                id: 'c1',
                name: 'Petrobras S.A.',
                cnpj: '00.000.000/0001-00',
                sector: 'Energia',
                assets: [{ id: 'a1', ticker: 'PETR4', name: 'Petrobras', share_class: 'PN' }],
                fundamentals: [],
            },
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Petrobras S.A.')).toBeInTheDocument())
        expect(screen.getByText('Energia · CNPJ 00.000.000/0001-00')).toBeInTheDocument()

        fireEvent.click(screen.getByText('PETR4'))
        await waitFor(() => expect(screen.getByText('tela de ativo')).toBeInTheDocument())
    })

    it('sem histórico de fundamentos, o gráfico mostra estado vazio', async () => {
        vi.mocked(getCompany).mockResolvedValue({
            company: { id: 'c2', name: 'Nova Empresa', cnpj: '00', sector: 'Tech', assets: [], fundamentals: [] },
        })

        renderPage()

        await waitFor(() =>
            expect(screen.getByText('Esta empresa ainda não tem ciclo de relatório suficiente pro gráfico.')).toBeInTheDocument(),
        )
    })
})
