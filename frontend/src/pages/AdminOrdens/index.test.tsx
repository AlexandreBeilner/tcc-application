import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { cancelAdminOrder, cancelAdminOrdersBatch, listAdminOrders, listMarketMonitor } from '../../services/admin'
import type { AdminOrder } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminOrdens } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAdminOrders: vi.fn(),
    cancelAdminOrder: vi.fn(),
    cancelAdminOrdersBatch: vi.fn(),
    listMarketMonitor: vi.fn(),
}))

const ASSET_ID = '0d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a22'

const order: AdminOrder = {
    order_id: 'o1',
    asset_id: ASSET_ID,
    ticker: 'ACME3',
    user_id: '1d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a33',
    is_bot: false,
    bot_archetype: null,
    side: 'buy',
    type: 'limit',
    quantity: 100,
    filled_quantity: 0,
    price: 10,
    status: 'pending',
    cancel_reason: null,
    simulated_day: 7,
    created_at: '2026-10-03T12:00:00Z',
}

function renderPage(initialEntry = '/admin/mercado/ordens') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <AdminOrdens />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAdminOrders).mockResolvedValue({ orders: [order], total: 1 })
    vi.mocked(listMarketMonitor).mockResolvedValue({ assets: [{ asset_id: ASSET_ID, ticker: 'ACME3' }] } as Awaited<
        ReturnType<typeof listMarketMonitor>
    >)
})

describe('AdminOrdens', () => {
    it('lista as ordens abertas por padrão', async () => {
        renderPage()
        expect(await screen.findByText('1 ordem(ns)')).toBeInTheDocument()
        expect(vi.mocked(listAdminOrders).mock.calls[0][1]).toMatchObject({ status: 'open', limit: 25, offset: 0 })
    })

    it('cancela uma ordem depois de confirmar', async () => {
        vi.mocked(cancelAdminOrder).mockResolvedValue(undefined)
        renderPage()
        const table = await screen.findByRole('table')
        fireEvent.click(within(table).getByRole('button', { name: 'Cancelar' }))
        const dialog = screen.getByRole('dialog', { name: 'Cancelar esta ordem?' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar ordem' }))

        await waitFor(() => expect(cancelAdminOrder).toHaveBeenCalledWith('tok', 'o1'))
        expect(await screen.findByText('Ordem de ACME3 cancelada.')).toBeInTheDocument()
    })

    it('mostra a recusa quando a ordem já foi executada (409)', async () => {
        vi.mocked(cancelAdminOrder).mockRejectedValue(new ApiError(409, 'já executada'))
        renderPage()
        const table = await screen.findByRole('table')
        fireEvent.click(within(table).getByRole('button', { name: 'Cancelar' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar ordem' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('já foi executada ou cancelada')
    })

    it('o lote fica desabilitado sem filtro de ativo ou dono', async () => {
        renderPage()
        await screen.findByRole('table')
        expect(screen.getByRole('button', { name: 'Cancelar ordens abertas do filtro' })).toBeDisabled()
    })

    it('lote por ativo exige digitar o ticker e depois cancela', async () => {
        vi.mocked(cancelAdminOrdersBatch).mockResolvedValue({ cancelled_count: 3, cancelled_ids: ['a', 'b', 'c'] })
        renderPage(`/admin/mercado/ordens?asset_id=${ASSET_ID}`)
        await screen.findByRole('table')
        await screen.findByText('ACME3', { selector: 'button *, button' })

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar ordens abertas do filtro' }))
        const dialog = screen.getByRole('dialog', { name: 'Cancelar ordens em lote?' })
        const confirm = within(dialog).getByRole('button', { name: 'Cancelar em lote' })
        expect(confirm).toBeDisabled()

        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'ACME3' } })
        fireEvent.click(confirm)

        await waitFor(() => expect(cancelAdminOrdersBatch).toHaveBeenCalledWith('tok', { asset_id: ASSET_ID, user_id: undefined }))
        expect(await screen.findByText('3 ordem(ns) cancelada(s).')).toBeInTheDocument()
    })

    it('lote acima do teto mostra a contagem e não cancela nada', async () => {
        vi.mocked(cancelAdminOrdersBatch).mockRejectedValue(new ApiError(422, 'x', { code: 'batch_too_large', matched: 501, max: 500 }))
        renderPage(`/admin/mercado/ordens?asset_id=${ASSET_ID}`)
        await screen.findByRole('table')
        await screen.findByText('ACME3', { selector: 'button *, button' })

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar ordens abertas do filtro' }))
        const dialog = screen.getByRole('dialog')
        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'ACME3' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar em lote' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('501 ordens, acima do teto de 500')
    })

    it('id de dono inválido é ignorado com aviso', async () => {
        renderPage()
        await screen.findByRole('table')
        fireEvent.change(screen.getByPlaceholderText('UUID, opcional'), { target: { value: 'abc' } })
        expect(await screen.findByRole('alert')).toHaveTextContent('UUID completo')
        await waitFor(() => {
            const last = vi.mocked(listAdminOrders).mock.calls.at(-1)?.[1]
            expect(last?.user_id).toBeUndefined()
        })
    })
})
