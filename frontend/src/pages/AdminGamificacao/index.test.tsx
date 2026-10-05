import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getAchievementCatalog, getAdminRanking, getMissionCatalog } from '../../services/admin'
import { AdminGamificacao } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    getAchievementCatalog: vi.fn(),
    createAchievement: vi.fn(),
    updateAchievement: vi.fn(),
    getMissionCatalog: vi.fn(),
    updateMission: vi.fn(),
    getAdminRanking: vi.fn(),
}))

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminGamificacao />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAchievementCatalog).mockResolvedValue({ achievements: [], criteria: [] })
    vi.mocked(getMissionCatalog).mockResolvedValue({ missions: [] })
    vi.mocked(getAdminRanking).mockResolvedValue({
        window: 'week',
        window_start: null,
        window_end: null,
        criterion: 'overall',
        entries: [],
        page: 1,
        page_size: 25,
        total_entries: 0,
        total_pages: 0,
    })
})

describe('AdminGamificacao', () => {
    it('abre em Conquistas e só consulta o que a aba aberta precisa', async () => {
        renderPage()

        expect(screen.getByRole('heading', { name: 'Gamificação' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Conquistas' })).toHaveAttribute('aria-selected', 'true')
        expect(await screen.findByText('Nenhuma conquista cadastrada.')).toBeInTheDocument()
        expect(getAchievementCatalog).toHaveBeenCalledTimes(1)
        expect(getMissionCatalog).not.toHaveBeenCalled()
        expect(getAdminRanking).not.toHaveBeenCalled()
    })

    it('troca de aba: missões e ranking só carregam quando abertos', async () => {
        renderPage()
        await screen.findByText('Nenhuma conquista cadastrada.')

        fireEvent.click(screen.getByRole('tab', { name: 'Missões diárias' }))
        expect(await screen.findByText('Nenhuma missão cadastrada.')).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Missões diárias' })).toHaveAttribute('aria-selected', 'true')
        expect(getAdminRanking).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('tab', { name: 'Ranking' }))
        expect(await screen.findByText('Ninguém no ranking neste critério ainda.')).toBeInTheDocument()
        expect(getAdminRanking).toHaveBeenCalledTimes(1)
    })
})
