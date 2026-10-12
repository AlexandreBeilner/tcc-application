import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { useWebPurchases } from '../../features/billing/useWebPurchases'
import { resetReportedFunnel } from '../../features/billing/useReportFunnel'
import { getBillingStatus, reportFunnelEvent } from '../../services/billing'
import type { BillingStatus } from '../../services/billing'
import type { WebPlan } from '../../features/billing/webPurchases'
import { Planos } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../features/billing/useWebPurchases', () => ({ useWebPurchases: vi.fn() }))

const FREE: BillingStatus = {
    isPro: false,
    state: 'none',
    plan: null,
    store: null,
    expiresAt: null,
    willRenew: false,
    managementUrl: null,
    billingEnabled: true,
}

const MONTHLY: WebPlan = { id: 'monthly', formattedPrice: 'R$ 19,97', amountMicros: 19_970_000, currency: 'BRL', handle: {} }
const ANNUAL: WebPlan = { id: 'annual', formattedPrice: 'R$ 199,97', amountMicros: 199_970_000, currency: 'BRL', handle: {} }

function renderPage(state?: unknown) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[{ pathname: '/planos', state }]}>
                <Planos />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Planos (MO.3.1)', () => {
    beforeEach(() => {
        resetReportedFunnel()
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'ana@x.com', username: 'ana', role: 'user', onboardingCompleted: true, avatarUrl: null },
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockResolvedValue([MONTHLY, ANNUAL]), purchase: vi.fn() })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra os preços do Offering e o desconto do anual calculado', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderPage()

        expect(await screen.findByText('R$ 19,97')).toBeInTheDocument()
        expect(screen.getByText('R$ 199,97')).toBeInTheDocument()
        // 1 - 199,97 / (19,97 * 12) = 16,5% -> 17%
        expect(screen.getByText(/17% a menos/)).toBeInTheDocument()
        expect(screen.getByText('O que continua grátis')).toBeInTheDocument()
    })

    it('não mostra preço quando a cobrança está desligada', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE, billingEnabled: false })
        renderPage()

        expect(await screen.findByText(/ainda não está disponível/)).toBeInTheDocument()
        expect(screen.queryByText('R$ 19,97')).not.toBeInTheDocument()
    })

    it('quem já é PRO vê o plano atual em vez da compra', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({
            ...FREE,
            isPro: true,
            state: 'active',
            plan: 'annual',
            store: 'stripe',
            expiresAt: '2027-03-01T12:00:00.000Z',
            willRenew: true,
        })
        renderPage()

        expect(await screen.findByText('Você já é PRO')).toBeInTheDocument()
        expect(screen.getByText(/Plano anual/)).toBeInTheDocument()
        expect(screen.queryByText('Escolha seu plano')).not.toBeInTheDocument()
    })

    it('assinar leva ao checkout do plano escolhido e libera o PRO sem recarregar', async () => {
        const purchase = vi.fn().mockResolvedValue('purchased')
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockResolvedValue([MONTHLY, ANNUAL]), purchase })
        vi.mocked(getBillingStatus)
            .mockResolvedValueOnce(FREE) // abertura da tela
            .mockResolvedValueOnce(FREE) // conferência antes da compra
            .mockResolvedValue({ ...FREE, isPro: true, state: 'active', plan: 'annual', store: 'stripe' })
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Assinar anual' }))

        await waitFor(() => expect(purchase).toHaveBeenCalledWith(ANNUAL))
        expect(await screen.findByText('Você já é PRO', {}, { timeout: 5000 })).toBeInTheDocument()
    })

    it('sem meio de compra neste ambiente, não mostra preço nem fica carregando', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        vi.mocked(useWebPurchases).mockReturnValue(null)
        renderPage()

        expect(await screen.findByText(/ainda não está disponível/)).toBeInTheDocument()
        expect(screen.queryByText(/Carregando preços/)).not.toBeInTheDocument()
    })

    it('dentro do app a compra vai pela camada nativa e libera o PRO', async () => {
        const purchase = vi.fn().mockResolvedValue('purchased')
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockResolvedValue([MONTHLY, ANNUAL]), purchase })
        vi.mocked(getBillingStatus)
            .mockResolvedValueOnce(FREE) // abertura da tela
            .mockResolvedValueOnce(FREE) // conferência antes da compra
            .mockResolvedValue({ ...FREE, isPro: true, state: 'active', plan: 'monthly', store: 'play_store' })
        Object.defineProperty(window, 'ReactNativeWebView', { value: {}, configurable: true })
        try {
            renderPage()
            fireEvent.click(await screen.findByRole('button', { name: 'Assinar mensal' }))

            await waitFor(() => expect(purchase).toHaveBeenCalledWith(MONTHLY))
            expect(await screen.findByText('Você já é PRO', {}, { timeout: 5000 })).toBeInTheDocument()
            expect(screen.queryByRole('link', { name: /pagamento|checkout/i })).not.toBeInTheDocument()
        } finally {
            delete (window as unknown as Record<string, unknown>).ReactNativeWebView
        }
    })

    it('dentro do app, "Restaurar compras" devolve o PRO quando a loja tem a assinatura', async () => {
        const restore = vi.fn().mockResolvedValue({ hasPro: true })
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockResolvedValue([MONTHLY, ANNUAL]), purchase: vi.fn(), restore })
        vi.mocked(getBillingStatus)
            .mockResolvedValueOnce(FREE)
            .mockResolvedValue({ ...FREE, isPro: true, state: 'active', plan: 'annual', store: 'play_store' })
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Restaurar compras' }))

        await waitFor(() => expect(restore).toHaveBeenCalled())
        expect(await screen.findByText('Você já é PRO', {}, { timeout: 5000 })).toBeInTheDocument()
    })

    it('restaurar sem assinatura na loja explica, sem erro', async () => {
        const restore = vi.fn().mockResolvedValue({ hasPro: false })
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockResolvedValue([MONTHLY, ANNUAL]), purchase: vi.fn(), restore })
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Restaurar compras' }))

        expect(await screen.findByText(/Não encontramos nenhuma assinatura ativa/)).toBeInTheDocument()
    })

    it('na web não há botão de restaurar', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderPage()
        await screen.findByText('R$ 19,97')
        expect(screen.queryByRole('button', { name: 'Restaurar compras' })).not.toBeInTheDocument()
    })

    it('no app, quem assinou por outra plataforma lê que já vale e não vê compra', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({
            ...FREE,
            isPro: true,
            state: 'active',
            plan: 'monthly',
            store: 'stripe',
            expiresAt: '2027-03-01T12:00:00.000Z',
            willRenew: true,
        })
        Object.defineProperty(window, 'ReactNativeWebView', { value: {}, configurable: true })
        Object.defineProperty(window, '__selucraNative', { value: { platform: 'android' }, configurable: true })
        try {
            renderPage()
            expect(await screen.findByText(/não é preciso assinar de novo/)).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /Assinar|Restaurar/ })).not.toBeInTheDocument()
        } finally {
            delete (window as unknown as Record<string, unknown>).ReactNativeWebView
            delete (window as unknown as Record<string, unknown>).__selucraNative
        }
    })

    it('mostra erro se o preço não carrega', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockRejectedValue(new Error('x')), purchase: vi.fn() })
        renderPage()

        expect(await screen.findByText(/Não foi possível carregar os preços/)).toBeInTheDocument()
    })

    it('funil: reporta a abertura dos planos com o ponto de convite de onde veio', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderPage({ proSource: 'duel' })

        await screen.findByText('R$ 19,97')
        await waitFor(() => expect(reportFunnelEvent).toHaveBeenCalledWith('token', { event: 'plans_opened', source: 'duel' }))
    })

    it('funil: sem convite de origem (ou origem desconhecida) vira "direct"', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderPage({ proSource: 'qualquer-coisa' })

        await screen.findByText('R$ 19,97')
        await waitFor(() => expect(reportFunnelEvent).toHaveBeenCalledWith('token', { event: 'plans_opened', source: 'direct' }))
    })

    it('funil: quem já é PRO não conta como abertura de planos', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE, isPro: true, state: 'active', plan: 'monthly', store: 'stripe' })
        renderPage()

        await screen.findByText('Você já é PRO')
        expect(reportFunnelEvent).not.toHaveBeenCalled()
    })

    it('funil: escolher um plano reporta a compra iniciada com o plano', async () => {
        const purchase = vi.fn().mockResolvedValue('cancelled')
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockResolvedValue([MONTHLY, ANNUAL]), purchase })
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderPage({ proSource: 'league' })

        fireEvent.click(await screen.findByRole('button', { name: 'Assinar anual' }))

        await waitFor(() =>
            expect(reportFunnelEvent).toHaveBeenCalledWith('token', { event: 'purchase_started', source: 'league', plan: 'annual' }),
        )
    })

    it('avisa que o app Android e iOS vem depois, sem link de loja (LW.1.2)', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderPage()

        expect(await screen.findByText(/App Android e iOS em breve/)).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /App Store|Google Play/i })).not.toBeInTheDocument()
    })

    it('dentro do app nativo o aviso "em breve" não aparece (LW.1.2)', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        Object.defineProperty(window, 'ReactNativeWebView', { value: {}, configurable: true })
        try {
            renderPage()
            await screen.findByText('R$ 19,97')

            expect(screen.queryByText(/App Android e iOS em breve/)).not.toBeInTheDocument()
        } finally {
            delete (window as unknown as Record<string, unknown>).ReactNativeWebView
        }
    })
})
