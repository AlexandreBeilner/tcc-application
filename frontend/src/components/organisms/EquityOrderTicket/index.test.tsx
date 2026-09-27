import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EquityOrderTicket } from '.'

describe('EquityOrderTicket', () => {
    it('sem cotação, desabilita o botão e mostra "—"', () => {
        render(<EquityOrderTicket unitPrice={undefined} onSubmit={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Revisar ordem' })).toBeDisabled()
    })

    it('calcula o total como preço unitário × quantidade', () => {
        render(<EquityOrderTicket unitPrice={10} onSubmit={vi.fn()} />)
        expect(screen.getAllByText('R$ 10,00').length).toBe(2)

        fireEvent.click(screen.getByLabelText('Aumentar'))
        expect(screen.getByText('R$ 20,00')).toBeInTheDocument()
    })

    it('quantidade nunca fica abaixo de 1', () => {
        render(<EquityOrderTicket unitPrice={10} onSubmit={vi.fn()} />)
        fireEvent.click(screen.getByLabelText('Diminuir'))
        expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('"Revisar ordem" chama onSubmit com o side e a quantidade atuais', () => {
        const onSubmit = vi.fn()
        render(<EquityOrderTicket unitPrice={10} onSubmit={onSubmit} />)
        fireEvent.click(screen.getByText('Vender'))
        fireEvent.click(screen.getByLabelText('Aumentar'))
        fireEvent.click(screen.getByRole('button', { name: 'Revisar ordem' }))
        expect(onSubmit).toHaveBeenCalledWith('sell', 2)
    })

    it('mercado fechado: desabilita "Revisar ordem" e mostra o motivo em texto', () => {
        render(
            <EquityOrderTicket
                unitPrice={10}
                closedReason="Mercado fechado: fim de semana simulado. Abre em 4h12, segunda 12/01"
                onSubmit={vi.fn()}
            />,
        )
        expect(screen.getByRole('button', { name: 'Revisar ordem' })).toBeDisabled()
        expect(screen.getByRole('status')).toHaveTextContent('Mercado fechado: fim de semana simulado')
    })
})
