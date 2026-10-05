import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getMarketMonitorAsset } from '../../services/admin'
import type { MonitorAssetDetail } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminMercadoAtivo } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ getMarketMonitorAsset: vi.fn() }))

const detail: MonitorAssetDetail = {
    asset_id: 'a1',
    ticker: 'ETFX11',
    name: 'ETF X',
    type: 'etf',
    sector: null,
    last_price: 99,
    daily_change_pct: -1,
    best_bid: 98.9,
    best_ask: 99.1,
    spread_pct: 0.2,
    resting_orders: 4,
    bot_resting_orders: 4,
    day_trades: 2,
    day_volume: 30,
    outstanding_shares: 1000,
    held_by_bots: 700,
    held_by_users: 100,
    covered: false,
    indicator: { kind: 'nav_premium_pct', value: -1.5 },
    bids: [{ price: 98.9, quantity: 50, bot_quantity: 30 }],
    asks: [{ price: 99.1, quantity: 40, bot_quantity: 40 }],
    trades: [{ simulated_day: 7, price: 99, quantity: 10, buyer_is_bot: true }],
    quotes: [
        { simulated_day: 6, price: 100 },
        { simulated_day: 7, price: 99 },
    ],
    nav_history: [{ simulated_day: 7, nav: 100.5, close_price: 99, premium_pct: -1.5 }],
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin/mercado/ativos/a1']}>
                <Routes>
                    <Route path="/admin/mercado/ativos/:id" element={<AdminMercadoAtivo />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('AdminMercadoAtivo (tela 10.7)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
        vi.mocked(getMarketMonitorAsset).mockReset().mockResolvedValue(detail)
    })

    it('mostra o resumo, o book com bots, os negócios e a série de NAV do ETF', async () => {
        renderPage()
        expect(await screen.findByRole('heading', { name: /ETFX11/ })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Sem Market Maker ativo cobrindo este ativo.')
        expect(screen.getByText('Ágio/deságio')).toBeInTheDocument()
        expect(screen.getByText('700 / 100 / 200')).toBeInTheDocument()
        const bids = screen.getByRole('region', { name: 'Ordens de compra' })
        expect(within(bids).getByText('30', { selector: 'td' })).toBeInTheDocument()
        expect(screen.getByRole('region', { name: 'Últimos negócios' })).toHaveTextContent('Bot')
        expect(screen.getByRole('region', { name: 'NAV do ETF' })).toHaveTextContent('100,50')
        expect(getMarketMonitorAsset).toHaveBeenCalledWith('tok', 'a1')
    })

    it('ação não mostra a seção de NAV', async () => {
        vi.mocked(getMarketMonitorAsset).mockResolvedValue({ ...detail, type: 'acao', nav_history: [] })
        renderPage()
        await screen.findByRole('heading', { name: /ETFX11/ })
        expect(screen.queryByRole('region', { name: 'NAV do ETF' })).not.toBeInTheDocument()
    })

    it('ativo inexistente mostra a mensagem de 404 e o caminho de volta', async () => {
        vi.mocked(getMarketMonitorAsset).mockRejectedValue(new ApiError(404, 'ativo não encontrado'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Ativo não encontrado')
        expect(screen.getByRole('link', { name: 'Voltar ao mercado' })).toHaveAttribute('href', '/admin/mercado')
    })

    it('falha genérica mostra o aviso sem quebrar', async () => {
        vi.mocked(getMarketMonitorAsset).mockRejectedValue(new Error('rede'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o ativo')
    })
})
