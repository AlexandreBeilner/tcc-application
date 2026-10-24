import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { castVote, getAssembly, getMyVotingStatus } from '../../services/assemblies'
import type { AssemblyDetail, MyVotingStatus } from '../../services/assemblies'
import { ApiError } from '../../services/client'
import { AssembleiaDetalhe } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/assemblies', () => ({ getAssembly: vi.fn(), getMyVotingStatus: vi.fn(), castVote: vi.fn() }))

const detail = (over: Partial<AssemblyDetail> = {}): AssemblyDetail => ({
    assembly: {
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
        description: 'O que fazer com o lucro do trimestre.',
    },
    options: [
        {
            id: 'o1',
            key: 'reinvestir',
            label: 'Reinvestir',
            gain: 'Mais crescimento',
            loss: 'Menos dividendo',
            effect: { metric: 'growth', direction: 1, intensity: 0.8 },
            effects: [{ metric: 'growth', direction: 1, intensity: 0.8 }],
            position: 0,
        },
        {
            id: 'o2',
            key: 'distribuir',
            label: 'Distribuir',
            gain: 'Mais dividendo',
            loss: 'Menos crescimento',
            effect: null,
            effects: [],
            position: 1,
        },
    ],
    scoreboard: {
        voters: 3,
        options: [
            { optionId: 'o1', voters: 2, weightPercent: 66.7 },
            { optionId: 'o2', voters: 1, weightPercent: 33.3 },
        ],
    },
    result: null,
    minVoters: 3,
    ...over,
})

const status = (over: Partial<MyVotingStatus> = {}): MyVotingStatus => ({
    assemblyId: 'a1',
    canVote: true,
    reason: null,
    message: null,
    myVote: null,
    myShares: 12,
    ...over,
})

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/assembleias/a1']}>
                <Routes>
                    <Route path="/assembleias/:id" element={<AssembleiaDetalhe />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('AssembleiaDetalhe (MO.6.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('mostra a ficha com ganho e perda dos dois lados, o placar e o peso do voto', async () => {
        vi.mocked(getAssembly).mockResolvedValue(detail())
        vi.mocked(getMyVotingStatus).mockResolvedValue(status())
        renderPage()

        expect(await screen.findByRole('heading', { name: 'Destinação do lucro' })).toBeInTheDocument()
        expect(screen.getByText('Mais crescimento')).toBeInTheDocument()
        expect(screen.getByText('Menos crescimento')).toBeInTheDocument()
        expect(screen.getByText(/Empurra para cima o ritmo de crescimento da empresa/)).toBeInTheDocument()
        expect(screen.getByText(/66,7% das ações · 2 votantes/)).toBeInTheDocument()
        expect(await screen.findByText(/Você tinha 12 ações/)).toBeInTheDocument()
    })

    it('vota na opção escolhida', async () => {
        vi.mocked(getAssembly).mockResolvedValue(detail())
        vi.mocked(getMyVotingStatus).mockResolvedValue(status())
        vi.mocked(castVote).mockResolvedValue({ optionId: 'o2', changed: false })
        renderPage()

        const buttons = await screen.findAllByRole('button', { name: 'Votar nesta opção' })
        fireEvent.click(buttons[1])
        await waitFor(() => expect(castVote).toHaveBeenCalledWith('token', 'a1', 'o2'))
        expect(await screen.findByText('Voto registrado.')).toBeInTheDocument()
    })

    it('quem já votou vê o próprio voto e pode trocar', async () => {
        vi.mocked(getAssembly).mockResolvedValue(detail())
        vi.mocked(getMyVotingStatus).mockResolvedValue(status({ myVote: { optionId: 'o1' } }))
        renderPage()

        expect(await screen.findByText('Seu voto')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Trocar meu voto para esta' })).toHaveLength(1)
        expect(screen.getByText(/Dá para trocar até a votação fechar/)).toBeInTheDocument()
    })

    it('quem não tem ações vê o motivo e não vota', async () => {
        vi.mocked(getAssembly).mockResolvedValue(detail())
        vi.mocked(getMyVotingStatus).mockResolvedValue(
            status({ canVote: false, reason: 'not_shareholder', message: 'Só quem tinha ações da empresa na abertura vota.', myShares: 0 }),
        )
        renderPage()

        expect(await screen.findByText(/Só quem tinha ações da empresa na abertura vota/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Votar nesta opção' })).toBeNull()
    })

    it('encerrada aprovada destaca o resultado e não oferece voto', async () => {
        vi.mocked(getAssembly).mockResolvedValue(
            detail({
                assembly: {
                    ...detail().assembly,
                    status: 'closed',
                    outcome: 'approved',
                    outcomeReason: 'decided',
                    voterCount: 3,
                    effectAppliedAt: null,
                },
                result: { outcome: 'approved', reason: 'decided', winningOptionId: 'o1', voterCount: 3, decidedAt: '2026-10-08T00:00:00Z' },
            }),
        )
        renderPage()

        expect(await screen.findByRole('heading', { name: 'Aprovada: Reinvestir' })).toBeInTheDocument()
        expect(screen.getByText(/O efeito começa em/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Votar|Trocar/ })).toBeNull()
        expect(getMyVotingStatus).not.toHaveBeenCalled()
    })

    it('sem quórum diz que nada muda', async () => {
        vi.mocked(getAssembly).mockResolvedValue(
            detail({
                assembly: { ...detail().assembly, status: 'closed', outcome: 'not_approved', outcomeReason: 'quorum' },
                result: {
                    outcome: 'not_approved',
                    reason: 'quorum',
                    winningOptionId: null,
                    voterCount: 1,
                    decidedAt: '2026-10-08T00:00:00Z',
                },
            }),
        )
        renderPage()
        expect(await screen.findByText(/Não houve votantes suficientes/)).toBeInTheDocument()
        expect(screen.getByText(/a empresa segue como estava/)).toBeInTheDocument()
    })

    it('assembleia inexistente (404) mostra aviso com volta para a lista', async () => {
        vi.mocked(getAssembly).mockRejectedValue(new ApiError(404, 'assembleia não encontrada'))
        renderPage()
        expect(await screen.findByText(/Esta assembleia não foi encontrada/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Todas as assembleias' })).toHaveAttribute('href', '/assembleias')
    })
})
