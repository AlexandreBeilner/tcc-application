import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TaxDecisionTreeWidget, taxDecisionTreeSummary } from '.'

describe('TaxDecisionTreeWidget', () => {
    it('ação vendida em outro dia pergunta o total do mês e dá o resultado', () => {
        render(<TaxDecisionTreeWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'Ação' }))
        fireEvent.click(screen.getByRole('button', { name: 'Não' }))
        expect(screen.getByText(/Responda as perguntas/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Até R$ 20 mil' }))
        expect(screen.getByText('Ganho isento de imposto.')).toBeInTheDocument()
    })

    it('day trade responde sem perguntar o valor', () => {
        render(<TaxDecisionTreeWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'Ação' }))
        fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
        expect(screen.getByText(/Day trade: 20%/)).toBeInTheDocument()
        expect(screen.queryByText(/3\./)).not.toBeInTheDocument()
    })

    it('ETF não tem isenção', () => {
        render(<TaxDecisionTreeWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'ETF' }))
        fireEvent.click(screen.getByRole('button', { name: 'Não' }))
        expect(screen.getByText(/ETF: 15%/)).toBeInTheDocument()
    })

    it('o resumo textual descreve a árvore', () => {
        expect(taxDecisionTreeSummary({})).toMatch(/R\$ 20 mil/)
    })
})
