import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import { AssemblyProBlock } from '.'

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

function renderBlock(billing: Partial<BillingStatus> = {}, hideLink = false) {
    vi.mocked(useAuth).mockReturnValue({ token: 't' } as ReturnType<typeof useAuth>)
    vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE, ...billing })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <AssemblyProBlock hideLink={hideLink} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('AssemblyProBlock (MO.9.7)', () => {
    beforeEach(() => vi.clearAllMocks())
    afterEach(() => vi.clearAllMocks())

    it('explica as regras e convida quem não é PRO, com a origem assembly', async () => {
        renderBlock()
        expect(await screen.findByRole('heading', { name: 'Como o PRO participa' })).toBeInTheDocument()
        expect(screen.getByText(/1 voto por mês, a partir do nível 3 e com e-mail verificado/)).toBeInTheDocument()
        expect(screen.getByText(/O resultado vale para todos os acionistas, tenham votado ou não/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Ver o que o PRO inclui' })).toHaveAttribute('href', '/planos')
        expect(screen.queryByText(/Você vota em todas/)).toBeNull()
    })

    it('para PRO mostra que vota em todas, sem link', async () => {
        renderBlock({ isPro: true, state: 'active' })
        expect(await screen.findByText('Você vota em todas as assembleias das empresas que possui.')).toBeInTheDocument()
        expect(screen.queryByRole('link')).toBeNull()
    })

    it('some o link quando o convite contextual já está na tela', async () => {
        renderBlock({}, true)
        await screen.findByRole('heading', { name: 'Como o PRO participa' })
        expect(screen.queryByRole('link')).toBeNull()
    })

    it('sem cobrança ativa mantém a explicação e tira o link', async () => {
        renderBlock({ billingEnabled: false })
        await screen.findByRole('heading', { name: 'Como o PRO participa' })
        expect(screen.queryByRole('link')).toBeNull()
    })
})
