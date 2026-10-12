import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import { ApiError } from '../../../services/client'
import { equipCosmetic, getMyCosmetics, unequipCosmetic } from '../../../services/cosmetics'
import type { MyCosmetics } from '../../../services/cosmetics'
import { CosmeticsPicker } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../../services/cosmetics', () => ({
    getMyCosmetics: vi.fn(),
    equipCosmetic: vi.fn(),
    unequipCosmetic: vi.fn(),
}))

const CATALOG: MyCosmetics['catalog'] = [
    { key: 'frame_aurora', kind: 'frame', name: 'Aurora', description: 'Verde-água e azul.', sortOrder: 10, unlockReferrals: null },
    {
        key: 'title_estrategista',
        kind: 'title',
        name: 'Estrategista',
        description: 'Monta o plano antes.',
        sortOrder: 10,
        unlockReferrals: null,
    },
    { key: 'title_mensageiro', kind: 'title', name: 'Mensageiro', description: 'Trouxe 5 amigos.', sortOrder: 90, unlockReferrals: 5 },
]

function mine(overrides: Partial<MyCosmetics> = {}): MyCosmetics {
    return {
        isPro: true,
        referralCount: 0,
        catalog: CATALOG,
        selection: { frame: null, title: null },
        display: { isPro: true, frame: null, title: null },
        ...overrides,
    }
}

const BILLING: BillingStatus = {
    isPro: true,
    state: 'active',
    plan: 'monthly',
    store: 'stripe',
    expiresAt: null,
    willRenew: true,
    managementUrl: null,
    billingEnabled: true,
}

function renderPicker() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <CosmeticsPicker username="ana" avatarUrl={null} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('CosmeticsPicker (MO.5.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        vi.mocked(getBillingStatus).mockResolvedValue(BILLING)
        localStorage.clear()
    })
    afterEach(() => vi.clearAllMocks())

    it('PRO escolhe uma moldura e vê o estado novo', async () => {
        vi.mocked(getMyCosmetics).mockResolvedValue(mine())
        vi.mocked(equipCosmetic).mockResolvedValue(
            mine({ selection: { frame: 'frame_aurora', title: null }, display: { isPro: true, frame: 'frame_aurora', title: null } }),
        )
        renderPicker()

        const option = await screen.findByRole('button', { name: /Aurora/ })
        expect(option).toHaveAttribute('aria-pressed', 'false')
        fireEvent.click(option)

        await waitFor(() => expect(equipCosmetic).toHaveBeenCalledWith('token', 'frame', 'frame_aurora'))
        await waitFor(() => expect(screen.getByRole('button', { name: /Aurora/ })).toHaveAttribute('aria-pressed', 'true'))
    })

    it('"Sem título" tira o título', async () => {
        vi.mocked(getMyCosmetics).mockResolvedValue(
            mine({ selection: { frame: null, title: 'title_estrategista' }, display: { isPro: true, frame: null, title: 'Estrategista' } }),
        )
        vi.mocked(unequipCosmetic).mockResolvedValue(mine())
        renderPicker()

        fireEvent.click(await screen.findByRole('button', { name: 'Sem título' }))

        await waitFor(() => expect(unequipCosmetic).toHaveBeenCalledWith('token', 'title'))
    })

    it('título liberado por convites aparece bloqueado com o motivo e libera ao alcançar o marco', async () => {
        vi.mocked(getMyCosmetics).mockResolvedValue(mine({ referralCount: 2 }))
        const { unmount } = renderPicker()
        const locked = await screen.findByRole('button', { name: /Mensageiro/ })
        expect(locked).toBeDisabled()
        expect(locked).toHaveTextContent('Libera com 5 amigos')
        unmount()

        vi.mocked(getMyCosmetics).mockResolvedValue(mine({ referralCount: 5 }))
        renderPicker()
        expect(await screen.findByRole('button', { name: /Mensageiro/ })).toBeEnabled()
    })

    it('quem não é PRO vê a vitrine sem poder escolher, com convite para conhecer o plano', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...BILLING, isPro: false, state: 'none' })
        vi.mocked(getMyCosmetics).mockResolvedValue(mine({ isPro: false, display: { isPro: false, frame: null, title: null } }))
        renderPicker()

        expect(await screen.findByRole('button', { name: /Aurora/ })).toBeDisabled()
        expect(screen.getByRole('link', { name: 'Conhecer o PRO' })).toHaveAttribute('href', '/planos')
    })

    it('quem cancelou vê que a escolha anterior continua guardada', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...BILLING, isPro: false, state: 'none' })
        vi.mocked(getMyCosmetics).mockResolvedValue(
            mine({ isPro: false, selection: { frame: 'frame_aurora', title: null }, display: { isPro: false, frame: null, title: null } }),
        )
        renderPicker()

        expect(await screen.findByText(/continuam guardadas/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Aurora/ })).toHaveAttribute('aria-pressed', 'true')
    })

    it('erro 403 de plano vira orientação, não mensagem técnica', async () => {
        vi.mocked(getMyCosmetics).mockResolvedValue(mine())
        vi.mocked(equipCosmetic).mockRejectedValue(new ApiError(403, 'requer plano PRO'))
        renderPicker()

        fireEvent.click(await screen.findByRole('button', { name: /Aurora/ }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Seu plano PRO não está ativo agora')
    })

    it('some quando a cobrança está desligada e a pessoa nunca foi PRO', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...BILLING, isPro: false, state: 'none', billingEnabled: false })
        vi.mocked(getMyCosmetics).mockResolvedValue(mine({ isPro: false }))
        const { container } = renderPicker()

        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        await waitFor(() => expect(container).toBeEmptyDOMElement())
    })
})
