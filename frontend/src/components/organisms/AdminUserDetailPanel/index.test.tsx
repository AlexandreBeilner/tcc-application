import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { AdminUserDetail } from '../../../services/admin'
import { AdminUserDetailPanel } from '.'

const detail: AdminUserDetail = {
    account: {
        id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
        name: 'Maria Souza',
        email: 'maria@example.com',
        username: 'maria',
        role: 'user',
        status: 'active',
        onboarding_completed: true,
        providers: ['password'],
        created_at: '2026-10-01T12:00:00Z',
        suspended_reason: null,
        suspended_at: null,
    },
    progression: { xp: 1200, level: 4, current_streak: 3, longest_streak: 9, last_qualifying_activity_date: '2026-10-02' },
    achievements_count: 5,
    friends_count: 2,
    portfolio: {
        cash: 4000,
        variable_income_value: 5000,
        fixed_income_value: 1500,
        net_worth: 10500,
        positions: [
            { asset_id: 'a1', ticker: 'BNDD3', name: 'Bandeira', type: 'stock', is_sandbox: false, quantity: 100, average_price: 50 },
        ],
    },
    open_orders: {
        total: 1,
        orders: [
            {
                order_id: 'o1',
                asset_id: 'a1',
                ticker: 'BNDD3',
                user_id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
                is_bot: false,
                bot_archetype: null,
                side: 'buy',
                type: 'limit',
                quantity: 10,
                filled_quantity: 0,
                price: 49,
                status: 'pending',
                cancel_reason: null,
                simulated_day: 3,
                created_at: '2026-10-03T12:00:00Z',
            },
        ],
    },
    timeline: [],
}

function renderPanel(value: AdminUserDetail) {
    return render(
        <MemoryRouter>
            <AdminUserDetailPanel detail={value} />
        </MemoryRouter>,
    )
}

describe('AdminUserDetailPanel', () => {
    it('mostra conta, progressão, patrimônio absoluto e ordens abertas com atalho pra tela de Ordens', () => {
        renderPanel(detail)
        expect(screen.getByRole('heading', { name: 'Conta' })).toBeInTheDocument()
        expect(screen.getByText('Ativa')).toBeInTheDocument()
        const progress = screen.getByRole('region', { name: 'Progressão' })
        expect(within(progress).getByText('4')).toBeInTheDocument()
        expect(within(progress).getByText('3 dia(s)')).toBeInTheDocument()
        const portfolio = screen.getByRole('region', { name: 'Carteira' })
        expect(within(portfolio).getByText(/10\.500,00/)).toBeInTheDocument()
        expect(within(portfolio).getByText('BNDD3')).toBeInTheDocument()
        const orders = screen.getByRole('region', { name: 'Ordens abertas' })
        expect(within(orders).getByRole('link', { name: 'Ver e cancelar na tela de Ordens' })).toHaveAttribute(
            'href',
            `/admin/mercado/ordens?user_id=${detail.account.id}`,
        )
        expect(screen.getByText('Nenhuma ação do painel sobre esta conta.')).toBeInTheDocument()
    })

    it('conta suspensa mostra o motivo; sem motor, carteira e ordens avisam a indisponibilidade', () => {
        renderPanel({
            ...detail,
            account: { ...detail.account, status: 'suspended', suspended_reason: 'spam no feed', suspended_at: '2026-10-03T12:00:00Z' },
            portfolio: null,
            open_orders: null,
        })
        expect(screen.getByText('Suspensa')).toBeInTheDocument()
        expect(screen.getByText('spam no feed')).toBeInTheDocument()
        expect(screen.getByText(/Carteira indisponível/)).toBeInTheDocument()
        expect(screen.getByText(/Ordens indisponíveis/)).toBeInTheDocument()
    })

    it('a linha do tempo mostra ação, motivo, autor e resultado', () => {
        renderPanel({
            ...detail,
            timeline: [
                {
                    id: 't1',
                    admin_id: 'adm',
                    admin_username: 'chefe',
                    action: 'user.suspend',
                    payload: { reason: 'spam no feed' },
                    result: 'success',
                    error_message: null,
                    occurred_at: '2026-10-03T12:00:00Z',
                },
            ],
        })
        const timeline = screen.getByRole('region', { name: 'Linha do tempo no painel' })
        expect(within(timeline).getByText(/Suspensão de conta/)).toBeInTheDocument()
        expect(within(timeline).getByText(/spam no feed/)).toBeInTheDocument()
        expect(within(timeline).getByText(/chefe/)).toBeInTheDocument()
    })
})
