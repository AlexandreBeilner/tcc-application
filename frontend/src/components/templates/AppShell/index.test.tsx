import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../../services/auth'
import { listNews } from '../../../services/news'
import { useAuth } from '../../../features/auth/AuthContext'
import { useUnlockedKeys } from '../../../features/lessons/useUnlockedKeys'
import { AppShell } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({
    useAuth: vi.fn(),
}))

vi.mock('../../../features/lessons/useUnlockedKeys', () => ({
    useUnlockedKeys: vi.fn(),
}))

vi.mock('../../../services/news', () => ({
    listNews: vi.fn(),
}))

function mockAuth(user: AuthUser, logout = vi.fn()) {
    vi.mocked(useAuth).mockReturnValue({
        token: 'token-valido',
        user,
        isLoading: false,
        login: vi.fn(),
        logout,
        setUser: vi.fn(),
    })
}

function renderShell() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/login', element: <div>tela de login</div> },
            { path: '/onboarding', element: <div>tela de onboarding</div> },
            {
                element: <AppShell />,
                children: [{ path: '/', element: <div>conteúdo da rota</div> }],
            },
        ],
        { initialEntries: ['/'] },
    )

    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

const user: AuthUser = {
    id: '1',
    name: 'Ana',
    email: 'ana@example.com',
    username: 'ana',
    role: 'user',
    onboardingCompleted: true,
    avatarUrl: null,
}

describe('AppShell', () => {
    beforeEach(() => {
        // Desbloqueado por padrão — estes testes não são sobre o gate da
        // tarefa 7.0.1 (ver `RequiresUnlock`/`TabBar` pros testes dedicados).
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(['portfolio', 'calculator', 'news_feed']),
            lessons: [],
            isLoading: false,
            isError: false,
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('renderiza os 5 itens de navegação primária e o conteúdo da rota', async () => {
        mockAuth(user)
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })

        renderShell()

        for (const label of ['Portfólio', 'Trilha', 'Mercado', 'Calculadora', 'Classificação']) {
            expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
        }
        expect(screen.getByText('conteúdo da rota')).toBeInTheDocument()
    })

    it('onboarding pendente redireciona pra /onboarding (tarefa 6.2) em vez de renderizar o shell', async () => {
        mockAuth({ ...user, onboardingCompleted: false })
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })

        renderShell()

        await waitFor(() => expect(screen.getByText('tela de onboarding')).toBeInTheDocument())
        expect(screen.queryByText('conteúdo da rota')).not.toBeInTheDocument()
    })

    it('menu do avatar não mostra Painel Administrativo pra usuário comum', async () => {
        mockAuth(user)
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })

        renderShell()
        fireEvent.click(screen.getByRole('button', { name: 'Menu do usuário' }))

        expect(screen.getByRole('menuitem', { name: 'Meu Perfil' })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Painel Administrativo' })).not.toBeInTheDocument()
    })

    it('menu do avatar mostra Painel Administrativo pra role=admin', async () => {
        mockAuth({ ...user, role: 'admin' })
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })

        renderShell()
        fireEvent.click(screen.getByRole('button', { name: 'Menu do usuário' }))

        expect(screen.getByRole('menuitem', { name: 'Painel Administrativo' })).toBeInTheDocument()
    })

    it('Sair chama logout e redireciona pra /login', async () => {
        const logout = vi.fn()
        mockAuth(user, logout)
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })

        renderShell()
        fireEvent.click(screen.getByRole('button', { name: 'Menu do usuário' }))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Sair' }))

        expect(logout).toHaveBeenCalled()
        await waitFor(() => expect(screen.getByText('tela de login')).toBeInTheDocument())
    })

    it('badge de notícias aparece quando há evento pendente não visto', async () => {
        mockAuth(user)
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'evt-1',
                    title: 't',
                    narrative: 'n',
                    direction: 'positivo',
                    magnitude_band: 'leve',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'pendente',
                    triggered_on_day: 1,
                    duration_days: 1,
                    targets: [],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: false,
                },
            ],
            total_entries: 1,
        })

        renderShell()

        await waitFor(() => expect(screen.getByLabelText('Há novidades não vistas')).toBeInTheDocument())
    })

    it('badge de notícias não aparece sem evento pendente', async () => {
        mockAuth(user)
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })

        renderShell()

        await waitFor(() => expect(vi.mocked(listNews)).toHaveBeenCalled())
        expect(screen.queryByLabelText('Há novidades não vistas')).not.toBeInTheDocument()
    })
})
