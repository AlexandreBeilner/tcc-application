import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getAdminAssembly } from '../../services/admin'
import type { AdminAssemblyDetail } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminAssembleiaDetalhe } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ getAdminAssembly: vi.fn() }))

const detail = (): AdminAssemblyDetail => ({
    assembly: {
        id: 'as1',
        kind: 'shareholder',
        subject_ref: 'c1',
        subject_label: 'Acme',
        title: 'Orçamento de capital',
        status: 'closed',
        opens_at: '2026-10-01T12:00:00Z',
        closes_at: '2026-10-08T12:00:00Z',
        effect_applies_at: '2026-10-09T12:00:00Z',
        effect_applied_at: null,
        outcome: 'approved',
        outcome_reason: 'decided',
        voter_count: 2,
        winning_option_id: 'o2',
        min_voters: 3,
        effect_pending: true,
        paused: true,
    },
    options: [
        {
            id: 'o1',
            key: 'a',
            label: 'Ampliar a capacidade',
            gain: 'Cresce.',
            loss: 'Margem menor.',
            effect: { metric: 'growth', direction: 1, intensity: 0.5 },
            position: 0,
            voters: 1,
            weight: 10,
        },
        {
            id: 'o2',
            key: 'b',
            label: 'Ganhar eficiência',
            gain: 'Margem.',
            loss: 'Cresce menos.',
            effect: null,
            position: 1,
            voters: 1,
            weight: 30,
        },
    ],
    min_voters: 3,
    counted_voters: 2,
    holders: 2,
    votes: [
        {
            user_id: 'u1',
            username: 'ana',
            name: 'Ana Souza',
            option_id: 'o1',
            weight: 10,
            eligible: true,
            created_at: '2026-10-02T12:00:00Z',
            updated_at: '2026-10-02T12:00:00Z',
        },
        {
            user_id: 'u2',
            username: 'bia',
            name: 'Bia Lima',
            option_id: 'o2',
            weight: 30,
            eligible: true,
            created_at: '2026-10-02T12:00:00Z',
            updated_at: '2026-10-03T12:00:00Z',
        },
        {
            user_id: 'u3',
            username: null,
            name: null,
            option_id: 'o1',
            weight: null,
            eligible: false,
            created_at: '2026-10-02T12:00:00Z',
            updated_at: '2026-10-02T12:00:00Z',
        },
    ],
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin/assembleias/as1']}>
                <Routes>
                    <Route path="/admin/assembleias/:id" element={<AdminAssembleiaDetalhe />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(getAdminAssembly).mockResolvedValue(detail())
})

describe('AdminAssembleiaDetalhe', () => {
    it('mostra o resumo com quórum, acionistas e votos que contam', async () => {
        renderPage()
        expect(await screen.findByRole('heading', { name: 'Acme: Orçamento de capital' })).toBeInTheDocument()
        expect(getAdminAssembly).toHaveBeenCalledWith('tok', 'as1')
        const summary = screen.getByRole('region', { name: 'Resumo' })
        expect(within(summary).getByText('Encerrada (pausada)')).toBeInTheDocument()
        expect(within(summary).getByText('2 de 3')).toBeInTheDocument()
        expect(within(summary).getByText('Aprovada')).toBeInTheDocument()
    })

    it('mostra quem votou em quê, com o peso, e marca o voto descartado', async () => {
        renderPage()
        const table = await screen.findByRole('table')
        const rows = within(table).getAllByRole('row').slice(1)
        expect(within(rows[0]).getByRole('link', { name: 'Ana Souza' })).toHaveAttribute('href', '/admin/usuarios/u1')
        expect(within(rows[0]).getByText('Ampliar a capacidade')).toBeInTheDocument()
        expect(within(rows[0]).getByText('10')).toBeInTheDocument()
        expect(within(rows[1]).getByText(/\(trocado\)/)).toBeInTheDocument()
        expect(within(rows[2]).getByText('descartado')).toBeInTheDocument()
    })

    it('destaca a opção vencedora e o placar por peso', async () => {
        renderPage()
        const options = await screen.findByRole('region', { name: 'Opções' })
        const items = within(options).getAllByRole('listitem')
        expect(within(items[1]).getByText('Vencedora')).toBeInTheDocument()
        expect(within(items[1]).getByText(/75%/)).toBeInTheDocument()
        expect(within(items[0]).getByText(/crescimento sobe, intensidade 0,5/)).toBeInTheDocument()
    })

    it('assembleia inexistente mostra o aviso e o caminho de volta', async () => {
        vi.mocked(getAdminAssembly).mockRejectedValue(new ApiError(404, 'não encontrada'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Essa assembleia não existe.')
        expect(screen.getByRole('link', { name: 'Voltar às assembleias' })).toBeInTheDocument()
    })
})
