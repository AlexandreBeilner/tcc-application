import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { liftTradingHalt, listMarketMonitor, listTradingHalts, pauseTrading } from '../../services/admin'
import type { TradingHalt } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminPausas } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listTradingHalts: vi.fn(),
    pauseTrading: vi.fn(),
    liftTradingHalt: vi.fn(),
    listMarketMonitor: vi.fn(),
}))

const halt = (overrides: Partial<TradingHalt>): TradingHalt => ({
    id: 'h1',
    scope: 'asset',
    asset_id: 'a1',
    ticker: 'ACME3',
    reason: 'volatilidade',
    created_by: 'admin-1',
    created_at: '2026-10-03T12:00:00Z',
    lifted_at: null,
    lifted_by: null,
    ...overrides,
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminPausas />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listTradingHalts).mockResolvedValue({ active: [], recent: [] })
    vi.mocked(listMarketMonitor).mockResolvedValue({
        assets: [
            { asset_id: 'a1', ticker: 'ACME3' },
            { asset_id: 'a2', ticker: 'BETA3' },
        ],
    } as Awaited<ReturnType<typeof listMarketMonitor>>)
})

describe('AdminPausas', () => {
    it('explica as consequências da pausa antes de qualquer ação', async () => {
        renderPage()
        expect(await screen.findByText(/A pausa não suspende o tick/)).toBeInTheDocument()
        expect(screen.getByText(/o book fica vazio ao retomar/)).toBeInTheDocument()
    })

    it('os botões ficam desabilitados até haver motivo', async () => {
        renderPage()
        const pauseAll = await screen.findByRole('button', { name: 'Pausar tudo' })
        expect(pauseAll).toBeDisabled()
        fireEvent.change(screen.getByPlaceholderText(/volatilidade anormal/), { target: { value: 'manutenção' } })
        expect(pauseAll).toBeEnabled()
    })

    it('pausar tudo exige digitar PAUSAR TUDO e envia escopo global com o motivo', async () => {
        vi.mocked(pauseTrading).mockResolvedValue(halt({ scope: 'global', asset_id: null, ticker: null }))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/volatilidade anormal/), { target: { value: '  manutenção  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Pausar tudo' }))

        const dialog = screen.getByRole('dialog', { name: 'Pausar a negociação de todo o mercado?' })
        const confirm = within(dialog).getByRole('button', { name: 'Pausar tudo' })
        expect(confirm).toBeDisabled()
        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'PAUSAR TUDO' } })
        fireEvent.click(confirm)

        await waitFor(() => expect(pauseTrading).toHaveBeenCalledWith('tok', { scope: 'global', reason: 'manutenção' }))
        expect(await screen.findByText('Negociação pausada em todo o mercado.')).toBeInTheDocument()
    })

    it('pausar um ativo exige digitar o ticker', async () => {
        vi.mocked(pauseTrading).mockResolvedValue(halt({}))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/volatilidade anormal/), { target: { value: 'volatilidade' } })
        fireEvent.click(screen.getByRole('button', { name: 'Ativo a pausar' }))
        fireEvent.click(await screen.findByRole('option', { name: 'ACME3' }))
        fireEvent.click(screen.getByRole('button', { name: 'Pausar ativo' }))

        const dialog = screen.getByRole('dialog', { name: 'Pausar a negociação de ACME3?' })
        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'ACME3' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Pausar ativo' }))

        await waitFor(() => expect(pauseTrading).toHaveBeenCalledWith('tok', { scope: 'asset', asset_id: 'a1', reason: 'volatilidade' }))
    })

    it('mercado já pausado desabilita "Pausar tudo"', async () => {
        vi.mocked(listTradingHalts).mockResolvedValue({
            active: [halt({ id: 'g', scope: 'global', asset_id: null, ticker: null })],
            recent: [],
        })
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/volatilidade anormal/), { target: { value: 'm' } })
        expect(await screen.findByRole('button', { name: 'Mercado já pausado' })).toBeDisabled()
    })

    it('retoma uma pausa vigente depois de confirmar', async () => {
        vi.mocked(listTradingHalts).mockResolvedValue({ active: [halt({})], recent: [] })
        vi.mocked(liftTradingHalt).mockResolvedValue(halt({ lifted_at: '2026-10-03T13:00:00Z', lifted_by: 'admin-1' }))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Retomar' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retomar' }))

        await waitFor(() => expect(liftTradingHalt).toHaveBeenCalledWith('tok', 'h1'))
        expect(await screen.findByText(/Negociação retomada/)).toBeInTheDocument()
    })

    it('conflito do motor (409) mostra a mensagem e mantém a tela', async () => {
        vi.mocked(pauseTrading).mockRejectedValue(new ApiError(409, 'já existe uma pausa vigente'))
        renderPage()
        fireEvent.change(await screen.findByPlaceholderText(/volatilidade anormal/), { target: { value: 'm' } })
        fireEvent.click(screen.getByRole('button', { name: 'Pausar tudo' }))
        const dialog = screen.getByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'PAUSAR TUDO' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Pausar tudo' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('O estado dessa pausa mudou')
    })
})
