import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PositionSummaryCard } from '.'

describe('PositionSummaryCard (tarefa S.16)', () => {
    it('com provento recebido, retorno total fica maior que o retorno de preço na proporção exata do provento', () => {
        render(<PositionSummaryCard quantity={10} averagePrice={100} markPrice={110} dividendsReceived={50} />)

        expect(screen.getByText('Sua posição')).toBeInTheDocument()
        expect(screen.getByText('10')).toBeInTheDocument()
        expect(screen.getByText('R$ 100,00')).toBeInTheDocument()
        expect(screen.getByText('R$ 110,00')).toBeInTheDocument()
        expect(screen.getByText('R$ 50,00')).toBeInTheDocument()
        // Retorno de preço: (110-100)/100 = +10,0%. Retorno total:
        // ((110-100)*10 + 50) / (100*10) = +15,0% — 5 p.p. a mais, exatamente
        // o provento (R$ 50) sobre o capital investido (R$ 1.000).
        expect(screen.getByText('+10,0%')).toBeInTheDocument()
        expect(screen.getByText('+15,0%')).toBeInTheDocument()
    })

    it('sem provento nenhum, os dois retornos são iguais', () => {
        render(<PositionSummaryCard quantity={5} averagePrice={50} markPrice={55} dividendsReceived={0} />)

        const matches = screen.getAllByText('+10,0%')
        expect(matches).toHaveLength(2)
    })

    it('sem markPrice, cai pro preço médio como preço atual (posição sem book real)', () => {
        render(<PositionSummaryCard quantity={1} averagePrice={100} dividendsReceived={0} />)

        expect(screen.getAllByText('R$ 100,00')).toHaveLength(2)
        expect(screen.getAllByText('0,0%')).toHaveLength(2)
    })
})
