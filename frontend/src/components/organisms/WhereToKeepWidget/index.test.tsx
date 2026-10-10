import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WhereToKeepWidget, whereToKeepSummary } from '.'

const choose = (product: string, label: 'Serve' | 'Não serve') => {
    const group = screen.getByRole('group', { name: `${product} serve para a reserva?` })
    fireEvent.click(within(group).getByRole('button', { name: label }))
}

describe('WhereToKeepWidget', () => {
    it('acerto mostra o motivo e conta o placar', () => {
        render(<WhereToKeepWidget />)
        choose('Tesouro Selic', 'Serve')

        expect(screen.getByText(/Certo\. Serve: Alta liquidez/)).toBeInTheDocument()
        expect(screen.getByText('Você acertou 1 de 1 resposta.')).toBeInTheDocument()
    })

    it('erro também mostra o motivo, sem contar ponto', () => {
        render(<WhereToKeepWidget />)
        choose('Ações', 'Serve')

        expect(screen.getByText(/Não é isso\. Não serve: O preço oscila/)).toBeInTheDocument()
        expect(screen.getByText('Você acertou 0 de 1 resposta.')).toBeInTheDocument()
    })

    it('o resumo lista os produtos', () => {
        expect(whereToKeepSummary({})).toMatch(/Tesouro Selic.*LCI com carência/)
    })
})
