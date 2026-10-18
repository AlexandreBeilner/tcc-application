import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrderBookWidget, orderBookSummary } from '.'

describe('OrderBookWidget', () => {
    it('começa com spread de R$ 0,05 e último negócio de R$ 10,00', () => {
        render(<OrderBookWidget />)

        expect(screen.getByText(/Último negócio: R\$\s10,00\. Spread: R\$\s0,05/)).toBeInTheDocument()
    })

    it('compra a mercado de 500 paga preço médio de R$ 10,07 e move o último negócio', () => {
        render(<OrderBookWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'Enviar ordem' }))

        expect(screen.getByText(/preço médio de R\$\s10,07/)).toBeInTheDocument()
        expect(screen.getByText(/Último negócio: R\$\s10,10/)).toBeInTheDocument()
    })

    it('compra limitada abaixo da melhor venda não executa e entra na fila', () => {
        render(<OrderBookWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'Limitada' }))
        fireEvent.change(screen.getByLabelText(/Preço limite/), { target: { value: '9.5' } })
        fireEvent.click(screen.getByRole('button', { name: 'Enviar ordem' }))

        expect(screen.getByText(/não executou/)).toBeInTheDocument()
        expect(screen.getByText(/ficaram no livro, na fila/)).toBeInTheDocument()
    })

    it('mostra a prévia antes de enviar: a mercado executa, limitada abaixo da venda espera na fila', () => {
        render(<OrderBookWidget />)
        expect(screen.getByText(/Prévia: executaria 500 ações, a R\$\s10,07 em média/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Limitada' }))
        expect(screen.getByText(/ninguém aceita agora, e a ordem esperaria na fila/)).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText(/Preço limite/), { target: { value: '10.05' } })
        expect(screen.getByText(/executaria 300 ações, a R\$\s10,05 em média e 200 esperariam na fila/)).toBeInTheDocument()
    })

    it('marca no livro a ordem que ficou esperando na fila', () => {
        render(<OrderBookWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'Limitada' }))
        fireEvent.click(screen.getByRole('button', { name: 'Enviar ordem' }))

        expect(screen.getByText(/sua ordem aqui/)).toBeInTheDocument()
    })

    it('onda de vendedores derruba o último negócio', () => {
        render(<OrderBookWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'Chega onda de vendedores' }))

        expect(screen.getByText(/Último negócio: R\$\s9,95/)).toBeInTheDocument()
    })

    it('reiniciar volta ao livro original', () => {
        render(<OrderBookWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'Chega onda de compradores' }))
        fireEvent.click(screen.getByRole('button', { name: 'Reiniciar o livro' }))

        expect(screen.getByText(/Último negócio: R\$\s10,00/)).toBeInTheDocument()
    })

    it('o resumo descreve o livro', () => {
        expect(orderBookSummary({})).toMatch(/quatro níveis de compra/)
    })
})
