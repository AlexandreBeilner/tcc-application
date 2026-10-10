import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { dismissProInvite } from '../../../features/billing/proInviteDismissal'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import { ProInvite } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn() }))

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

function renderInvite(billing: Partial<BillingStatus> = {}) {
    vi.mocked(useAuth).mockReturnValue({ token: 't' } as ReturnType<typeof useAuth>)
    vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE, ...billing })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <ProInvite context="league" title="Criar uma liga">
                    Faz parte do plano PRO.
                </ProInvite>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('ProInvite (MO.5.5)', () => {
    beforeEach(() => localStorage.clear())
    afterEach(() => {
        vi.clearAllMocks()
        delete (window as unknown as Record<string, unknown>).ReactNativeWebView
    })

    it('convida quem não é PRO, com link para os planos', async () => {
        renderInvite()
        expect(await screen.findByText('Faz parte do plano PRO.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Conhecer o PRO' })).toHaveAttribute('href', '/planos')
    })

    it('não aparece para quem já é PRO', async () => {
        renderInvite({ isPro: true, state: 'active' })
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        expect(screen.queryByText('Faz parte do plano PRO.')).toBeNull()
    })

    it('não aparece com a cobrança desligada', async () => {
        renderInvite({ billingEnabled: false })
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        expect(screen.queryByText('Faz parte do plano PRO.')).toBeNull()
    })

    it('dispensar esconde e lembra a escolha por contexto', async () => {
        renderInvite()
        fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
        expect(screen.queryByText('Faz parte do plano PRO.')).toBeNull()
        expect(JSON.parse(localStorage.getItem('app.proInvite.dismissed') as string)).toHaveProperty('league')
    })

    it('já dispensado nos últimos 30 dias não volta', async () => {
        dismissProInvite('league')
        renderInvite()
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        expect(screen.queryByText('Faz parte do plano PRO.')).toBeNull()
    })

    it('dentro do app mostra só o texto, sem link para /planos', async () => {
        ;(window as unknown as Record<string, unknown>).ReactNativeWebView = {}
        renderInvite()
        expect(await screen.findByText('Faz parte do plano PRO.')).toBeInTheDocument()
        expect(screen.queryByRole('link')).toBeNull()
    })
})
