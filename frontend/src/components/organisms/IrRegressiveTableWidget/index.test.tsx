import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IrRegressiveTableWidget } from '.'

describe('IrRegressiveTableWidget', () => {
    it('destaca a faixa do prazo e calcula o imposto', () => {
        render(<IrRegressiveTableWidget grossYield={1000} initialDays={90} />)

        expect(screen.getByText(/▶ Até 180 dias/)).toBeInTheDocument()
        expect(screen.getByText(/Imposto de 22,5%/)).toHaveTextContent('R$ 225,00')
        expect(screen.getByText(/Rendimento líquido/)).toHaveTextContent('R$ 775,00')
    })

    it('mover o prazo troca a faixa', () => {
        render(<IrRegressiveTableWidget grossYield={1000} initialDays={90} />)
        fireEvent.change(screen.getByLabelText(/Prazo da aplicação/), { target: { value: '800' } })

        expect(screen.getByText(/▶ Acima de 720 dias/)).toBeInTheDocument()
        expect(screen.getByText(/Rendimento líquido/)).toHaveTextContent('R$ 850,00')
    })
})
