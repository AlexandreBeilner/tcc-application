import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAssemblies } from '../../services/assemblies'
import type { AssemblySummary } from '../../services/assemblies'
import { ApiError } from '../../services/client'
import { Assembleias } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/assemblies', () => ({ listAssemblies: vi.fn() }))

const summary = (over: Partial<AssemblySummary>): AssemblySummary => ({
    id: 'a1',
    kind: 'shareholder',
    subjectRef: 'c1',
    subjectLabel: 'Acme',
    title: 'Destinação do lucro',
    status: 'open',
    opensAt: '2026-10-01T00:00:00Z',
    closesAt: '2099-10-08T00:00:00Z',
    effectAppliesAt: '2099-10-09T00:00:00Z',
    effectAppliedAt: null,
    outcome: null,
    outcomeReason: null,
    voterCount: null,
    dividendOnHold: false,
    ...over,
})

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Assembleias />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Assembleias (MO.6.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('lista abertas e encerradas com o estado em texto e link para a assembleia', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({
            open: [summary({})],
            closed: [
                summary({
                    id: 'a2',
                    status: 'closed',
                    title: 'Endividamento',
                    outcome: 'approved',
                    outcomeReason: 'decided',
                    voterCount: 4,
                }),
            ],
        })
        renderPage()

        expect(await screen.findByText('Destinação do lucro')).toBeInTheDocument()
        expect(screen.getByText('Votação aberta')).toBeInTheDocument()
        expect(screen.getByText('Aprovada')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Destinação do lucro/ })).toHaveAttribute('href', '/assembleias/a1')
        expect(screen.getByRole('heading', { name: 'Encerradas' })).toBeInTheDocument()
        expect(screen.getByText(/Com poucos votantes ou empate, nada muda/)).toBeInTheDocument()
    })

    it('sem votação aberta explica quando abre a próxima, sem pressão', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({ open: [], closed: [] })
        renderPage()
        expect(await screen.findByText(/Nenhuma votação aberta/)).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Encerradas' })).toBeNull()
    })

    it('recurso desligado (404) mostra aviso em vez de tela quebrada', async () => {
        vi.mocked(listAssemblies).mockRejectedValue(new ApiError(404, 'não encontrado'))
        renderPage()
        expect(await screen.findByText(/ainda não estão disponíveis/)).toBeInTheDocument()
    })
})
