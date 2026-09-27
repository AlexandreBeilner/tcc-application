import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AssetBook } from '../../../services/market'
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

    const book: AssetBook = {
        is_sandbox: false,
        price: null,
        best_bid: 9,
        best_ask: 11,
        mid_price: 10,
        bids: [{ price: 9, quantity: 50 }],
        asks: [
            { price: 11, quantity: 2 },
            { price: 12, quantity: 50 },
        ],
    }

    it('com book real, mostra o melhor bid/ask e o custo estimado pela profundidade (não pelo último negócio)', () => {
        render(<EquityOrderTicket unitPrice={10} book={book} onSubmit={vi.fn()} />)

        expect(screen.getByText('R$ 9,00 · R$ 11,00')).toBeInTheDocument()
        expect(screen.getByText('Preço médio estimado')).toBeInTheDocument()
        // 1 cota, toda no melhor ask (11), não no último negócio (10).
        expect(screen.getAllByText('R$ 11,00').length).toBeGreaterThan(0)
    })

    it('com book real, quantidade além da profundidade visível avisa que o custo é estimado', () => {
        const shallowBook: AssetBook = { ...book, asks: [{ price: 11, quantity: 2 }] }
        render(<EquityOrderTicket unitPrice={10} book={shallowBook} onSubmit={vi.fn()} />)

        fireEvent.click(screen.getByLabelText('Aumentar')) // 2
        fireEvent.click(screen.getByLabelText('Aumentar')) // 3, além dos 2 do único nível

        expect(screen.getByText(/Profundidade visível do book insuficiente/)).toBeInTheDocument()
    })

    it('sem book (sandbox/carregando), mantém o comportamento anterior: último negócio × quantidade', () => {
        render(<EquityOrderTicket unitPrice={10} onSubmit={vi.fn()} />)
        expect(screen.getByText('Preço unitário')).toBeInTheDocument()
        expect(screen.queryByText('Preço médio estimado')).not.toBeInTheDocument()
    })

    it('"Usar o máximo" na compra usa a profundidade do book e o saldo em caixa', () => {
        const onSubmit = vi.fn()
        render(<EquityOrderTicket unitPrice={10} book={book} cashBalance={35} onSubmit={onSubmit} />)

        // 2 * 11 = 22 (sobra 13), 13/12 = 1 -> total 3
        fireEvent.click(screen.getByText('Usar o máximo'))
        fireEvent.click(screen.getByRole('button', { name: 'Revisar ordem' }))
        expect(onSubmit).toHaveBeenCalledWith('buy', 3)
    })

    it('"Usar o máximo" na venda usa a quantidade possuída, não o book', () => {
        const onSubmit = vi.fn()
        render(<EquityOrderTicket unitPrice={10} book={book} ownedQuantity={7} onSubmit={onSubmit} />)

        fireEvent.click(screen.getByText('Vender'))
        fireEvent.click(screen.getByText('Usar o máximo'))
        fireEvent.click(screen.getByRole('button', { name: 'Revisar ordem' }))
        expect(onSubmit).toHaveBeenCalledWith('sell', 7)
    })

    it('sem saldo/posição informados, não mostra "Usar o máximo"', () => {
        render(<EquityOrderTicket unitPrice={10} book={book} onSubmit={vi.fn()} />)
        expect(screen.queryByText('Usar o máximo')).not.toBeInTheDocument()
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
