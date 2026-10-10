import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getBillingConversion } from '../../services/billing'
import type { BillingConversion } from '../../services/billing'
import { AdminAssinaturas } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/billing', () => ({ getBillingConversion: vi.fn() }))

const DATA: BillingConversion = {
    windowDays: 30,
    generatedAt: '2026-10-10T12:00:00Z',
    subscribers: { active: 7, monthly: 5, annual: 2, unknown: 0 },
    recurringRevenueCents: 12_000,
    churn: { cancelled: 1, startOfWindow: 8, rate: 0.125 },
    funnel: { lessonCompleted: 120, inviteViewed: 40, plansOpened: 20, purchaseStarted: 9, subscribed: 3, cancelled: 1 },
    bySource: [
        { source: 'league', reached: 20, inviteViewed: 18, plansOpened: 8, purchaseStarted: 4, subscribed: 2, conversionRate: 0.1 },
        { source: 'duel', reached: 0, inviteViewed: 0, plansOpened: 0, purchaseStarted: 0, subscribed: 0, conversionRate: null },
        { source: 'cosmetics', reached: 5, inviteViewed: 5, plansOpened: 2, purchaseStarted: 1, subscribed: 1, conversionRate: 0.2 },
        { source: 'retrospective', reached: 0, inviteViewed: 0, plansOpened: 0, purchaseStarted: 0, subscribed: 0, conversionRate: null },
        { source: 'direct', reached: 3, inviteViewed: 0, plansOpened: 3, purchaseStarted: 2, subscribed: 0, conversionRate: 0 },
    ],
}

function renderPage() {
    vi.mocked(useAuth).mockReturnValue({ token: 'tk' } as ReturnType<typeof useAuth>)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <AdminAssinaturas />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('AdminAssinaturas (MO.7.1)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('mostra assinantes por plano, receita estimada, churn e funil', async () => {
        vi.mocked(getBillingConversion).mockResolvedValue(DATA)
        renderPage()

        const subscribers = await screen.findByRole('region', { name: 'Assinantes ativos' })
        expect(within(subscribers).getByText('7')).toBeInTheDocument()
        expect(within(subscribers).getByText('Mensal').nextSibling).toHaveTextContent('5')
        expect(within(subscribers).getByText('Anual').nextSibling).toHaveTextContent('2')

        const revenue = screen.getByRole('region', { name: 'Receita recorrente' })
        expect(within(revenue).getByText(/R\$\s120,00/)).toBeInTheDocument()
        expect(within(revenue).getByText('12,5%')).toBeInTheDocument()

        const funnel = screen.getByRole('list', { name: 'Funil de conversão' })
        expect(within(funnel).getAllByRole('listitem')).toHaveLength(6)
        expect(within(funnel).getByText('Assinaram').closest('li')).toHaveTextContent('3')
    })

    it('tabela por ponto de convite com a conversão, e traço quando ninguém foi alcançado', async () => {
        vi.mocked(getBillingConversion).mockResolvedValue(DATA)
        renderPage()

        const row = await screen.findByRole('row', { name: /Ligas/ })
        expect(within(row).getByText('10%')).toBeInTheDocument()
        expect(within(screen.getByRole('row', { name: /Duelos/ })).getByText('—')).toBeInTheDocument()
        expect(screen.getAllByRole('row')).toHaveLength(6)
    })

    it('sem preços configurados, a receita fica em branco e o painel diz por quê', async () => {
        vi.mocked(getBillingConversion).mockResolvedValue({ ...DATA, recurringRevenueCents: null })
        renderPage()

        expect(await screen.findByText(/BILLING_PRICE_MONTHLY_CENTS/)).toBeInTheDocument()
    })

    it('trocar a janela consulta de novo com os dias escolhidos', async () => {
        vi.mocked(getBillingConversion).mockResolvedValue(DATA)
        renderPage()
        await screen.findByRole('region', { name: 'Assinantes ativos' })
        expect(getBillingConversion).toHaveBeenCalledWith('tk', 30)

        fireEvent.click(screen.getByRole('button', { name: '7 dias' }))

        await screen.findByRole('button', { name: '7 dias', pressed: true })
        expect(getBillingConversion).toHaveBeenCalledWith('tk', 7)
    })

    it('erro ao carregar vira aviso, sem derrubar a tela', async () => {
        vi.mocked(getBillingConversion).mockRejectedValue(new Error('x'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    })
})
