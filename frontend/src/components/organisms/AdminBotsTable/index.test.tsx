import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AdminBot } from '../../../services/admin'
import { AdminBotsTable } from '.'

const marketMaker: AdminBot = {
    account_id: '00000000-0000-0000-0001-000000000002',
    archetype: 'market_maker',
    is_active: true,
    cash: 2500,
    scope: { sectors: ['Varejo'], risk_classes: [], asset_classes: ['fii'], within_scope_pct: 0.9 },
    knowledge_level: null,
    risk_profile: { max_position_size_pct: 0.5, market_order_preference: 0.5, spread_width_pct: 0.02 },
    max_covered_assets: 10,
    covered_assets: [
        { asset_id: 'a1', ticker: 'AAA3' },
        { asset_id: 'a2', ticker: 'BBB3' },
    ],
    holdings: [{ asset_id: 'a1', ticker: 'AAA3', quantity: 40, average_price: 12.5 }],
}
const chartist: AdminBot = {
    ...marketMaker,
    account_id: '00000000-0000-0000-0002-000000000001',
    archetype: 'chartista',
    is_active: false,
    max_covered_assets: null,
    covered_assets: [],
    holdings: [],
}

function renderTable(
    bots: AdminBot[],
    handlers = { onToggle: vi.fn(), onEditCoverage: vi.fn(), onToggleActivity: vi.fn(), onEdit: vi.fn(), onFund: vi.fn() },
    updatingId: string | null = null,
    expandedId: string | null = null,
) {
    render(
        <MemoryRouter>
            <AdminBotsTable
                bots={bots}
                updatingId={updatingId}
                emptyMessage="Nenhum bot."
                expandedId={expandedId}
                renderDetail={(bot) => <p>Detalhe de {bot.account_id.slice(-6)}</p>}
                {...handlers}
            />
        </MemoryRouter>,
    )
    return handlers
}

describe('AdminBotsTable', () => {
    it('mostra a mensagem vazia sem bots', () => {
        renderTable([])
        expect(screen.getByText('Nenhum bot.')).toBeInTheDocument()
    })

    it('mostra arquétipo, escopo, caixa, posições e cobertura do Market Maker', () => {
        renderTable([marketMaker])
        const table = screen.getByRole('table')
        expect(within(table).getByText('Market Maker')).toBeInTheDocument()
        expect(within(table).getByText('Varejo, FIIs, 90% da atividade')).toBeInTheDocument()
        expect(within(table).getByText(/R\$\s*2\.500,00/)).toBeInTheDocument()
        expect(within(table).getByText('1 ativo')).toBeInTheDocument()
        expect(within(table).getByText('2 de 10')).toBeInTheDocument()
        expect(within(table).getByText('AAA3, BBB3')).toBeInTheDocument()
        expect(within(table).getByRole('link', { name: '000002' })).toHaveAttribute(
            'href',
            '/admin/mercado/ordens?user_id=00000000-0000-0000-0001-000000000002',
        )
    })

    it('status vira texto e o inativo oferece Ativar; só o Market Maker tem Cobertura', () => {
        renderTable([marketMaker, chartist])
        const table = screen.getByRole('table')
        expect(within(table).getByText('Ativo')).toBeInTheDocument()
        expect(within(table).getByText('Inativo')).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Desativar' })).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Ativar' })).toBeInTheDocument()
        expect(within(table).getAllByRole('button', { name: 'Cobertura' })).toHaveLength(1)
        expect(within(table).getByText('Sem posição')).toBeInTheDocument()
        expect(within(table).getByText('Não se aplica')).toBeInTheDocument()
    })

    it('os botões repassam o bot da linha', () => {
        const handlers = renderTable([marketMaker])
        const table = screen.getByRole('table')
        fireEvent.click(within(table).getByRole('button', { name: 'Desativar' }))
        fireEvent.click(within(table).getByRole('button', { name: 'Cobertura' }))
        expect(handlers.onToggle).toHaveBeenCalledWith(marketMaker)
        expect(handlers.onEditCoverage).toHaveBeenCalledWith(marketMaker)
    })

    it('trava só os botões do bot em alteração', () => {
        renderTable(
            [marketMaker, chartist],
            { onToggle: vi.fn(), onEditCoverage: vi.fn(), onToggleActivity: vi.fn(), onEdit: vi.fn(), onFund: vi.fn() },
            marketMaker.account_id,
        )
        const table = screen.getByRole('table')
        expect(within(table).getByRole('button', { name: 'Desativar' })).toBeDisabled()
        expect(within(table).getByRole('button', { name: 'Cobertura' })).toBeDisabled()
        expect(within(table).getByRole('button', { name: 'Ativar' })).toBeEnabled()
    })

    it('o botão Desempenho repassa o bot e o detalhe aparece só no bot expandido', () => {
        const handlers = renderTable([marketMaker, chartist], undefined, null, marketMaker.account_id)
        const table = screen.getByRole('table')
        expect(within(table).getAllByText('Detalhe de 000002')).toHaveLength(1)
        expect(within(table).queryByText('Detalhe de 000001')).not.toBeInTheDocument()
        fireEvent.click(within(table).getByRole('button', { name: 'Ocultar desempenho' }))
        fireEvent.click(within(table).getByRole('button', { name: 'Desempenho' }))
        expect(handlers.onToggleActivity).toHaveBeenNthCalledWith(1, marketMaker)
        expect(handlers.onToggleActivity).toHaveBeenNthCalledWith(2, chartist)
    })

    it('Editar e Aportar repassam o bot da linha e existem em todo arquétipo', () => {
        const handlers = renderTable([marketMaker, chartist])
        const table = screen.getByRole('table')
        expect(within(table).getAllByRole('button', { name: 'Editar' })).toHaveLength(2)
        expect(within(table).getAllByRole('button', { name: 'Aportar' })).toHaveLength(2)
        fireEvent.click(within(table).getAllByRole('button', { name: 'Editar' })[1])
        fireEvent.click(within(table).getAllByRole('button', { name: 'Aportar' })[0])
        expect(handlers.onEdit).toHaveBeenCalledWith(chartist)
        expect(handlers.onFund).toHaveBeenCalledWith(marketMaker)
    })

    it('trava Editar e Aportar do bot em alteração', () => {
        renderTable([marketMaker], undefined, marketMaker.account_id)
        const table = screen.getByRole('table')
        expect(within(table).getByRole('button', { name: 'Editar' })).toBeDisabled()
        expect(within(table).getByRole('button', { name: 'Aportar' })).toBeDisabled()
    })
})
