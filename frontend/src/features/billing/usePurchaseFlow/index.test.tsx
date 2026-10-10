import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import { useWebPurchases } from '../useWebPurchases'
import type { WebPlan, WebPurchases } from '../webPurchases'
import { usePurchaseFlow } from '.'

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn() }))
vi.mock('../useWebPurchases', () => ({ useWebPurchases: vi.fn() }))

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
const PRO: BillingStatus = { ...FREE, isPro: true, state: 'active', plan: 'monthly', store: 'stripe' }
const PLAN: WebPlan = { id: 'monthly', formattedPrice: 'R$ 19,97', amountMicros: 19_970_000, currency: 'BRL', handle: {} }

function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

describe('usePurchaseFlow (MO.3.2)', () => {
    let purchases: WebPurchases

    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        purchases = { loadPlans: vi.fn(), purchase: vi.fn() }
        vi.mocked(useWebPurchases).mockReturnValue(purchases)
    })

    afterEach(() => vi.clearAllMocks())

    it('depois do pagamento espera o servidor confirmar o PRO, sem recarregar', async () => {
        vi.mocked(purchases.purchase).mockResolvedValue('purchased')
        // 1ª: conferência antes de abrir a folha; 2ª: primeira espera (ainda free); 3ª: PRO.
        vi.mocked(getBillingStatus).mockResolvedValueOnce(FREE).mockResolvedValueOnce(FREE).mockResolvedValue(PRO)
        const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 1000 }), { wrapper })

        await act(() => result.current.start(PLAN))

        expect(getBillingStatus).toHaveBeenCalledTimes(3)
        expect(result.current.phase).toBe('idle')
    })

    it('cancelar a janela de pagamento volta sem consultar nem errar', async () => {
        vi.mocked(purchases.purchase).mockResolvedValue('cancelled')
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 1000 }), { wrapper })

        await act(() => result.current.start(PLAN))

        expect(getBillingStatus).toHaveBeenCalledTimes(1) // só a conferência prévia
        expect(result.current.phase).toBe('idle')
    })

    it('quem já é PRO (por outra plataforma) não abre a compra', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...PRO, store: 'app_store' })
        const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 1000 }), { wrapper })

        await act(() => result.current.start(PLAN))

        expect(purchases.purchase).not.toHaveBeenCalled()
        expect(result.current.phase).toBe('idle')
    })

    it('se a conferência prévia falha, não compra e mostra erro', async () => {
        vi.mocked(getBillingStatus).mockRejectedValue(new Error('rede'))
        const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 1000 }), { wrapper })

        await act(() => result.current.start(PLAN))

        expect(purchases.purchase).not.toHaveBeenCalled()
        expect(result.current.phase).toBe('error')
    })

    it('para de esperar no limite de tempo e avisa', async () => {
        vi.mocked(purchases.purchase).mockResolvedValue('purchased')
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 40 }), { wrapper })

        await act(() => result.current.start(PLAN))

        await waitFor(() => expect(result.current.phase).toBe('timeout'))
    })

    it('erro no checkout vira fase de erro', async () => {
        vi.mocked(purchases.purchase).mockRejectedValue(new Error('boom'))
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 40 }), { wrapper })

        await act(() => result.current.start(PLAN))

        expect(result.current.phase).toBe('error')
    })

    describe('restaurar compras (MO.4.3)', () => {
        beforeEach(() => {
            purchases.restore = vi.fn()
        })

        it('sem restauração na porta (web), não há o que restaurar', () => {
            vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn(), purchase: vi.fn() })
            const { result } = renderHook(() => usePurchaseFlow(), { wrapper })
            expect(result.current.canRestore).toBe(false)
        })

        it('a loja devolve PRO: espera o servidor confirmar', async () => {
            vi.mocked(purchases.restore!).mockResolvedValue({ hasPro: true })
            vi.mocked(getBillingStatus).mockResolvedValueOnce(FREE).mockResolvedValue(PRO)
            const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 1000 }), { wrapper })

            await act(() => result.current.restore())

            expect(getBillingStatus).toHaveBeenCalledTimes(2)
            expect(result.current.phase).toBe('idle')
        })

        it('a loja não tem assinatura: avisa, sem consultar o servidor', async () => {
            vi.mocked(purchases.restore!).mockResolvedValue({ hasPro: false })
            const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 1000 }), { wrapper })

            await act(() => result.current.restore())

            expect(result.current.phase).toBe('nothing-to-restore')
            expect(getBillingStatus).not.toHaveBeenCalled()
        })

        it('falha da loja vira erro, com a ação de restaurar', async () => {
            vi.mocked(purchases.restore!).mockRejectedValue(new Error('x'))
            const { result } = renderHook(() => usePurchaseFlow({ intervalMs: 5, timeoutMs: 1000 }), { wrapper })

            await act(() => result.current.restore())

            expect(result.current.phase).toBe('error')
            expect(result.current.action).toBe('restore')
        })
    })
})
