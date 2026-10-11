import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminReauthProvider } from '../../features/admin/AdminReauth'
import { useAuth } from '../../features/auth/AuthContext'
import { liftAssemblyPause, listAdminAssemblies, listAdminCatalog, listAssemblyPauses, pauseAssemblies } from '../../services/admin'
import type { AdminAssembly, AssemblyPause, CatalogAsset } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminAssembleias } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAdminAssemblies: vi.fn(),
    listAssemblyPauses: vi.fn(),
    pauseAssemblies: vi.fn(),
    liftAssemblyPause: vi.fn(),
    listAdminCatalog: vi.fn(),
}))

const assembly = (overrides: Partial<AdminAssembly> = {}): AdminAssembly => ({
    id: 'as1',
    kind: 'shareholder',
    subject_ref: 'c1',
    subject_label: 'Acme',
    title: 'Orçamento de capital',
    status: 'open',
    opens_at: '2026-10-10T12:00:00Z',
    closes_at: '2026-10-17T12:00:00Z',
    effect_applies_at: '2026-10-18T12:00:00Z',
    effect_applied_at: null,
    outcome: null,
    outcome_reason: null,
    voter_count: null,
    winning_option_id: null,
    min_voters: 3,
    effect_pending: false,
    paused: false,
    declaration_id: null,
    dividend_on_hold: false,
    ...overrides,
})

const pause = (overrides: Partial<AssemblyPause> = {}): AssemblyPause => ({
    id: 'p1',
    scope: 'company',
    company_id: 'c1',
    reason: 'revisão',
    created_by: 'admin-1',
    created_at: '2026-10-11T12:00:00Z',
    lifted_at: null,
    lifted_by: null,
    ...overrides,
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminReauthProvider>
                    <AdminAssembleias />
                </AdminReauthProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAdminAssemblies).mockResolvedValue([assembly()])
    vi.mocked(listAssemblyPauses).mockResolvedValue({ active: [], recent: [] })
    vi.mocked(listAdminCatalog).mockResolvedValue([
        { company: { company_id: 'c1', name: 'Acme' } },
        { company: { company_id: 'c1', name: 'Acme' } },
        { company: { company_id: 'c2', name: 'Beta' } },
        { company: null },
    ] as unknown as CatalogAsset[])
})

describe('AdminAssembleias', () => {
    it('marca a assembleia que segura o dividendo da empresa (destinação do lucro)', async () => {
        vi.mocked(listAdminAssemblies).mockResolvedValue([
            assembly({ id: 'x1', title: 'Pauta do lucro', declaration_id: 'd1', dividend_on_hold: true }),
            assembly({ id: 'x2', title: 'Pauta comum' }),
        ])
        renderPage()
        const retida = (await screen.findByText(/Pauta do lucro/)).closest('li') as HTMLElement
        expect(within(retida).getByText('Dividendo retido')).toBeInTheDocument()
        const comum = screen.getByText(/Pauta comum/).closest('li') as HTMLElement
        expect(within(comum).queryByText('Dividendo retido')).not.toBeInTheDocument()
    })

    it('lista as assembleias com situação, datas e o link dos votos', async () => {
        renderPage()
        expect(await screen.findByText('Acme: Orçamento de capital')).toBeInTheDocument()
        expect(screen.getByText('Aberta')).toBeInTheDocument()
        expect(screen.getByText('Mínimo: 3')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Ver votos' })).toHaveAttribute('href', '/admin/assembleias/as1')
    })

    it('marca a pausada e o efeito pendente de uma aprovada', async () => {
        vi.mocked(listAdminAssemblies).mockResolvedValue([
            assembly({
                status: 'closed',
                outcome: 'approved',
                outcome_reason: 'decided',
                effect_pending: true,
                paused: true,
                voter_count: 4,
            }),
        ])
        renderPage()
        expect(await screen.findByText('Pausada')).toBeInTheDocument()
        expect(screen.getByText('Efeito pendente')).toBeInTheDocument()
        expect(screen.getByText('Aprovada')).toBeInTheDocument()
    })

    it('sem assembleias mostra o vazio', async () => {
        vi.mocked(listAdminAssemblies).mockResolvedValue([])
        renderPage()
        expect(await screen.findByText('Nenhuma assembleia por aqui ainda.')).toBeInTheDocument()
    })

    it('explica o que a pausa faz antes de qualquer ação', async () => {
        renderPage()
        expect(await screen.findByText(/Impede abrir assembleia nova e aplicar efeito/)).toBeInTheDocument()
        expect(screen.getByText(/Fechar e apurar seguem/)).toBeInTheDocument()
    })

    it('os botões de pausa ficam desabilitados até haver motivo', async () => {
        renderPage()
        const all = await screen.findByRole('button', { name: 'Pausar todas' })
        expect(all).toBeDisabled()
        fireEvent.change(screen.getByPlaceholderText(/revisão das pautas/), { target: { value: 'ajuste' } })
        expect(all).toBeEnabled()
    })

    it('pausar todas exige digitar a confirmação e envia o escopo global com o motivo', async () => {
        vi.mocked(pauseAssemblies).mockResolvedValue(pause({ scope: 'global', company_id: null }))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/revisão das pautas/), { target: { value: '  ajuste  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Pausar todas' }))

        const dialog = screen.getByRole('dialog', { name: 'Pausar todas as assembleias?' })
        const confirm = within(dialog).getByRole('button', { name: 'Pausar todas' })
        expect(confirm).toBeDisabled()
        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'PAUSAR ASSEMBLEIAS' } })
        fireEvent.click(confirm)

        await waitFor(() => expect(pauseAssemblies).toHaveBeenCalledWith('tok', { scope: 'global', reason: 'ajuste' }))
        expect(await screen.findByText('Todas as assembleias pausadas.')).toBeInTheDocument()
    })

    it('pausar uma empresa lista cada empresa uma vez e exige digitar o nome', async () => {
        vi.mocked(pauseAssemblies).mockResolvedValue(pause())
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/revisão das pautas/), { target: { value: 'ajuste' } })
        fireEvent.click(screen.getByRole('button', { name: 'Empresa a pausar' }))
        expect(await screen.findAllByRole('option', { name: 'Acme' })).toHaveLength(1)
        fireEvent.click(screen.getByRole('option', { name: 'Acme' }))
        fireEvent.click(screen.getByRole('button', { name: 'Pausar empresa' }))

        const dialog = screen.getByRole('dialog', { name: 'Pausar as assembleias de Acme?' })
        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'Acme' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Pausar empresa' }))

        await waitFor(() => expect(pauseAssemblies).toHaveBeenCalledWith('tok', { scope: 'company', company_id: 'c1', reason: 'ajuste' }))
    })

    it('pausa global vigente desabilita "Pausar todas"', async () => {
        vi.mocked(listAssemblyPauses).mockResolvedValue({ active: [pause({ scope: 'global', company_id: null })], recent: [] })
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/revisão das pautas/), { target: { value: 'ajuste' } })
        expect(await screen.findByRole('button', { name: 'Já pausadas' })).toBeDisabled()
    })

    it('retoma uma pausa vigente depois de confirmar', async () => {
        vi.mocked(listAssemblyPauses).mockResolvedValue({ active: [pause()], recent: [] })
        vi.mocked(liftAssemblyPause).mockResolvedValue(pause({ lifted_at: '2026-10-11T13:00:00Z', lifted_by: 'admin-1' }))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Retomar' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retomar' }))

        await waitFor(() => expect(liftAssemblyPause).toHaveBeenCalledWith('tok', 'p1'))
        expect(await screen.findByText(/Assembleias retomadas/)).toBeInTheDocument()
    })

    it('conflito (409) mostra a mensagem e mantém a tela', async () => {
        vi.mocked(pauseAssemblies).mockRejectedValue(new ApiError(409, 'já existe'))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/revisão das pautas/), { target: { value: 'ajuste' } })
        fireEvent.click(screen.getByRole('button', { name: 'Pausar todas' }))
        const dialog = screen.getByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'PAUSAR ASSEMBLEIAS' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Pausar todas' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('O estado mudou')
    })
})
