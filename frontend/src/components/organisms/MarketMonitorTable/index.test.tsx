import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { MonitorAsset } from '../../../services/admin'
import { MarketMonitorTable } from '.'

const traded: MonitorAsset = {
    asset_id: 'a1',
    ticker: 'ACME3',
    name: 'Acme ON',
    type: 'acao',
    sector: 'Energia',
    last_price: 22,
    daily_change_pct: 10,
    best_bid: 21.8,
    best_ask: 22.2,
    spread_pct: 1.8,
    resting_orders: 3,
    bot_resting_orders: 2,
    day_trades: 1,
    day_volume: 10,
    outstanding_shares: 1000,
    held_by_bots: 300,
    held_by_users: 40,
    covered: true,
    indicator: { kind: 'price_to_earnings', value: 11 },
}

const quiet: MonitorAsset = {
    ...traded,
    asset_id: 'a2',
    ticker: 'ETFX11',
    type: 'etf',
    sector: null,
    last_price: null,
    daily_change_pct: null,
    best_bid: null,
    best_ask: null,
    spread_pct: null,
    resting_orders: 0,
    bot_resting_orders: 0,
    day_trades: 0,
    day_volume: 0,
    outstanding_shares: null,
    covered: false,
    indicator: { kind: 'nav_premium_pct', value: -1.5 },
}

function renderTable(onSort = vi.fn(), assets = [traded, quiet]) {
    render(
        <MemoryRouter>
            <MarketMonitorTable assets={assets} sortKey="ticker" sortDirection="asc" onSort={onSort} emptyMessage="Nada por aqui." />
        </MemoryRouter>,
    )
    return onSort
}

describe('MarketMonitorTable', () => {
    it('mostra preço, variação, book, ordens e indicador de cada classe', () => {
        renderTable()
        const row = screen.getAllByRole('row')[1]
        expect(within(row).getByRole('link', { name: 'ACME3' })).toHaveAttribute('href', '/admin/mercado/ativos/a1')
        expect(within(row).getByText('+10,0%')).toBeInTheDocument()
        expect(within(row).getByText(/R\$\s*21,80 \/ R\$\s*22,20 \(1,8%\)/)).toBeInTheDocument()
        expect(within(row).getByText('2 de bots')).toBeInTheDocument()
        expect(within(row).getByText('P/L')).toBeInTheDocument()
    })

    it('ativo sem negócio nem book aparece sem quebrar e avisa a falta de Market Maker', () => {
        renderTable()
        const row = screen.getAllByRole('row')[2]
        expect(within(row).getByText('Sem ofertas')).toBeInTheDocument()
        expect(within(row).getByText('Sem Market Maker')).toBeInTheDocument()
        expect(within(row).getByText('Ágio/deságio')).toBeInTheDocument()
        expect(within(row).getByText('−1,5%')).toBeInTheDocument()
    })

    it('clicar no cabeçalho ordena e marca a coluna ativa', () => {
        const onSort = renderTable()
        expect(screen.getByRole('columnheader', { name: /Ativo/ })).toHaveAttribute('aria-sort', 'ascending')
        fireEvent.click(screen.getByRole('button', { name: /Variação/ }))
        expect(onSort).toHaveBeenCalledWith('daily_change_pct')
    })

    it('lista vazia mostra a mensagem', () => {
        renderTable(vi.fn(), [])
        expect(screen.getByText('Nada por aqui.')).toBeInTheDocument()
    })
})
