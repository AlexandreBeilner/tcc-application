import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BotsSummary } from '../../../services/admin'
import { BotHealthPanel } from '.'

const healthy: BotsSummary = {
    simulated_day: 20,
    idle_days: 3,
    active_bots: 5,
    idle_bots: [],
    low_cash_bots: [],
    empty_inventory: [],
    liquidity: [{ asset_id: 'a1', ticker: 'AAA3', resting_by_provider: { market_maker: 200, usuario: 20 } }],
    float_concentration: [
        {
            asset_id: 'a1',
            ticker: 'AAA3',
            top_bot_id: '00000000-0000-0000-0001-000000000002',
            top_bot_archetype: 'market_maker',
            top_bot_pct: 12.5,
            all_bots_pct: 80,
            outstanding_shares: 1000,
        },
    ],
}

const alerting: BotsSummary = {
    ...healthy,
    idle_bots: [
        { account_id: '00000000-0000-0000-0002-000000000001', archetype: 'chartista', last_order_day: 5 },
        { account_id: '00000000-0000-0000-0002-000000000002', archetype: 'ruido', last_order_day: null },
    ],
    low_cash_bots: [{ account_id: '00000000-0000-0000-0002-000000000003', archetype: 'ruido', cash: 1, capital: 500 }],
    empty_inventory: [{ account_id: '00000000-0000-0000-0001-000000000002', asset_id: 'a1', ticker: 'AAA3' }],
}

describe('BotHealthPanel', () => {
    it('sem alerta, diz que está tudo certo', () => {
        render(<BotHealthPanel summary={healthy} onOpenActivity={vi.fn()} />)
        expect(screen.getByRole('status')).toHaveTextContent('Nenhum alerta: os 5 bots ativos')
    })

    it('lista bots parados, sem caixa e coberturas sem ações', () => {
        render(<BotHealthPanel summary={alerting} onOpenActivity={vi.fn()} />)
        expect(screen.getByText('2 bots parados')).toBeInTheDocument()
        expect(screen.getByText(/última no dia 5/)).toBeInTheDocument()
        expect(screen.getByText(/nunca enviou/)).toBeInTheDocument()
        expect(screen.getByText('1 bot sem caixa')).toBeInTheDocument()
        expect(screen.getByText('1 cobertura sem ações')).toBeInTheDocument()
        expect(screen.queryByText(/Nenhum alerta/)).not.toBeInTheDocument()
    })

    it('clicar no bot abre o desempenho dele', () => {
        const onOpenActivity = vi.fn()
        render(<BotHealthPanel summary={alerting} onOpenActivity={onOpenActivity} />)
        fireEvent.click(screen.getByRole('button', { name: 'Chartista 000001' }))
        expect(onOpenActivity).toHaveBeenCalledWith('00000000-0000-0000-0002-000000000001')
    })

    it('mostra liquidez por provedor e concentração de float', () => {
        render(<BotHealthPanel summary={healthy} onOpenActivity={vi.fn()} />)
        expect(screen.getByText(/Market Maker 200, Usuários 20/)).toBeInTheDocument()
        expect(screen.getByText(/tem 12,5%, todos os bots 80%/)).toBeInTheDocument()
    })
})
