import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getFixedIncomeTaxRate } from '../../services/market'
import { listMissions } from '../../services/missions'
import { Calculator } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ getFixedIncomeTaxRate: vi.fn() }))
vi.mock('../../services/missions', () => ({ listMissions: vi.fn(), completeMission: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <Calculator />
        </QueryClientProvider>,
    )
}

describe('Calculator (telas 6.1/6.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getFixedIncomeTaxRate).mockResolvedValue({ tax_rate: 0.175 })
        vi.mocked(listMissions).mockResolvedValue({ missions: [] })
    })

    afterEach(() => vi.clearAllMocks())

    it('abre no modo simples por padrão', () => {
        renderPage()
        expect(screen.getByText('Total final')).toBeInTheDocument()
    })

    it('alterna pro modo comparação sem navegar (mesma tela, nova variação de estado)', () => {
        renderPage()
        fireEvent.click(screen.getByText('Comparar produtos'))
        expect(screen.getByLabelText('Prazo (dias corridos)')).toBeInTheDocument()
    })
})
