import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BotActivity } from '../../../services/admin'
import { BotActivityPanel } from '.'

const activity: BotActivity = {
    account_id: '00000000-0000-0000-0001-000000000002',
    archetype: 'market_maker',
    is_active: true,
    from_day: 16,
    to_day: 20,
    period_days: 5,
    cash: 5000,
    holdings_value: 1000,
    net_worth: 6000,
    capital_contributed: 5800,
    pnl: 200,
    pnl_pct: 3.45,
    orders: {
        sent: 5,
        filled: 1,
        partially_filled: 0,
        open: 2,
        cancelled: 2,
        cancelled_by_reason: { requoted: 1, admin: 1 },
        fill_rate_pct: 25,
    },
    trades: 1,
    volume: 500,
    last_order_at: '2026-10-03T12:00:00Z',
    last_order_day: 20,
    quotes: [
        {
            asset_id: 'a1',
            ticker: 'AAA3',
            best_bid: 9.8,
            best_ask: 10.2,
            spread_pct: 4,
            held_quantity: 100,
            target_quantity: 200,
            inventory_pct: 50,
        },
        {
            asset_id: 'a2',
            ticker: 'BBB3',
            best_bid: null,
            best_ask: null,
            spread_pct: null,
            held_quantity: 0,
            target_quantity: 0,
            inventory_pct: null,
        },
    ],
}

function renderPanel(props: Partial<React.ComponentProps<typeof BotActivityPanel>> = {}) {
    const onDaysChange = vi.fn()
    render(<BotActivityPanel activity={activity} isLoading={false} isError={false} days={5} onDaysChange={onDaysChange} {...props} />)
    return { onDaysChange }
}

describe('BotActivityPanel', () => {
    it('mostra carregando e erro sem quebrar', () => {
        renderPanel({ activity: undefined, isLoading: true })
        expect(screen.getByText('Carregando desempenho…')).toBeInTheDocument()
    })

    it('mostra a falha como alerta', () => {
        renderPanel({ activity: undefined, isError: true })
        expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o desempenho')
    })

    it('mostra resultado com sinal explícito, atividade da janela e motivos de cancelamento', () => {
        renderPanel()
        expect(screen.getByText(/\+R\$\s*200,00/)).toBeInTheDocument()
        expect(screen.getByText(/dias simulados 16 a 20/)).toBeInTheDocument()
        expect(screen.getByText('25%')).toBeInTheDocument()
        expect(screen.getByText(/recotada por Market Maker \(1\)/)).toBeInTheDocument()
        expect(screen.getByText(/por intervenção do admin \(1\)/)).toBeInTheDocument()
    })

    it('mostra a cotação do Market Maker e marca ativo sem book', () => {
        renderPanel()
        expect(screen.getByText('AAA3')).toBeInTheDocument()
        expect(screen.getByText(/100 de 200 \(50%\)/)).toBeInTheDocument()
        expect(screen.getByText('Sem book')).toBeInTheDocument()
    })

    it('bot direcional não mostra tabela de cotação', () => {
        renderPanel({ activity: { ...activity, quotes: [], last_order_at: null, last_order_day: null } })
        expect(screen.queryByText('Cotação atual por ativo coberto')).not.toBeInTheDocument()
        expect(screen.getByText('Nunca enviou')).toBeInTheDocument()
    })

    it('trocar a janela repassa os dias', async () => {
        const { onDaysChange } = renderPanel()
        fireEvent.click(screen.getByRole('button', { name: /Janela do desempenho/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'Últimos 30 dias' }))
        expect(onDaysChange).toHaveBeenCalledWith(30)
    })
})
