import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { listAssemblies } from '../../../services/assemblies'
import type { AssemblySummary } from '../../../services/assemblies'
import { ApiError } from '../../../services/client'
import { DividendOnHoldNotice } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/assemblies', () => ({ listAssemblies: vi.fn() }))

const summary = (over: Partial<AssemblySummary> = {}): AssemblySummary => ({
    id: 'a1',
    kind: 'shareholder',
    subjectRef: 'c1',
    subjectLabel: 'Acme',
    title: 'O que fazer com o lucro',
    status: 'open',
    opensAt: '2026-10-01T00:00:00Z',
    closesAt: '2099-10-08T00:00:00Z',
    effectAppliesAt: '2099-10-09T00:00:00Z',
    effectAppliedAt: null,
    outcome: null,
    outcomeReason: null,
    voterCount: null,
    dividendOnHold: true,
    ...over,
})

function renderIt() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <DividendOnHoldNotice companyId="c1" />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('DividendOnHoldNotice (MO.6.14)', () => {
    beforeEach(() => vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>))
    afterEach(() => vi.clearAllMocks())

    it('avisa que o dividendo do balanço depende da assembleia em andamento e leva até ela', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({ open: [summary()], closed: [] })
        renderIt()
        expect(await screen.findByText(/O dividendo deste balanço depende da assembleia em andamento/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Ver a assembleia' })).toHaveAttribute('href', '/assembleias/a1')
        expect(listAssemblies).toHaveBeenCalledWith('token', { companyId: 'c1', status: 'open' })
    })

    it('assembleia aberta que não segura dividendo (pauta comum) não mostra aviso', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({ open: [summary({ dividendOnHold: false })], closed: [] })
        const { container } = renderIt()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(container).toBeEmptyDOMElement()
    })

    it('sem assembleia aberta não mostra aviso', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({ open: [], closed: [] })
        const { container } = renderIt()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(container).toBeEmptyDOMElement()
    })

    it('recurso desligado no servidor não mostra nada (nem quebra a tela do ativo)', async () => {
        vi.mocked(listAssemblies).mockRejectedValue(new ApiError(404, 'x'))
        const { container } = renderIt()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(container).toBeEmptyDOMElement()
    })
})
