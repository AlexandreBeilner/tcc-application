import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { RewardRevealProvider } from '../../../features/shell/RewardRevealProvider'
import { getFixedIncomeTaxRate } from '../../../services/market'
import { completeMission, listMissions } from '../../../services/missions'
import { FixedIncomeComparisonForm } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/market', () => ({ getFixedIncomeTaxRate: vi.fn() }))
vi.mock('../../../services/missions', () => ({ listMissions: vi.fn(), completeMission: vi.fn() }))

function renderForm() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <RewardRevealProvider>
                <FixedIncomeComparisonForm />
            </RewardRevealProvider>
        </QueryClientProvider>,
    )
}

const compareMission = {
    id: 'mission-compare',
    key: 'calculator_compare',
    title: 'Compare dois produtos de renda fixa na calculadora',
    description: 'Use a calculadora financeira pra comparar dois produtos de renda fixa.',
    completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase',
    xpReward: 30,
    requiresLessonCompletion: false,
    status: 'pending' as const,
}

describe('FixedIncomeComparisonForm (tela 6.2)', () => {
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
        vi.mocked(listMissions).mockResolvedValue({ missions: [compareMission] })
        vi.mocked(completeMission).mockResolvedValue({ status: 'completed' })
    })

    afterEach(() => vi.clearAllMocks())

    it('produto isento (default LCI) sempre mostra alíquota 0%, mesmo com a taxa de mercado vindo do motor', async () => {
        renderForm()
        await waitFor(() => expect(getFixedIncomeTaxRate).toHaveBeenCalledWith('token', 365))
        const zeroRates = await screen.findAllByText('0.0%')
        expect(zeroRates.length).toBeGreaterThan(0)
    })

    it('produto tributado (default CDB) mostra a alíquota vinda do motor', async () => {
        renderForm()
        expect(await screen.findByText('17.5%')).toBeInTheDocument()
    })

    it('marca o vencedor (maior valor líquido) com a etiqueta "Rende mais líquido"', async () => {
        renderForm()
        expect(await screen.findByText('Rende mais líquido')).toBeInTheDocument()
    })

    it('marcar o segundo produto como não-isento troca a alíquota dele pra a de mercado', async () => {
        renderForm()
        await screen.findByText('Rende mais líquido')

        const checkboxes = screen.getAllByLabelText('Isento de IR')
        fireEvent.click(checkboxes[1])

        const rates = await screen.findAllByText('17.5%')
        expect(rates.length).toBe(2)
    })

    it('reporta a missão "calculator_compare" quando os dois produtos têm resultado calculado', async () => {
        renderForm()
        await waitFor(() => expect(completeMission).toHaveBeenCalledWith('token', 'mission-compare'))
    })
})
