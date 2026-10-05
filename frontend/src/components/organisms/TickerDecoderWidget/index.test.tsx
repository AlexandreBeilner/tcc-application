import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TICKER_ITEMS, TickerDecoderWidget, tickerDecoderSummary } from '.'

describe('TickerDecoderWidget', () => {
    it('acerto mostra a regra do final do ticker', () => {
        render(<TickerDecoderWidget />)
        fireEvent.click(within(screen.getByRole('group', { name: 'O que é VALR3?' })).getByRole('button', { name: 'Ordinária (ON)' }))

        expect(screen.getByText(/Certo\. Final 3: ação ordinária/)).toBeInTheDocument()
        expect(screen.getByText('Você acertou 1 de 1 resposta.')).toBeInTheDocument()
    })

    it('erro diz a resposta certa', () => {
        render(<TickerDecoderWidget />)
        fireEvent.click(within(screen.getByRole('group', { name: 'O que é VALR3F?' })).getByRole('button', { name: 'Ordinária (ON)' }))

        expect(screen.getByText(/Não é isso, é Mercado fracionário/)).toBeInTheDocument()
    })

    it('o catálogo usa só tickers de exemplo', () => {
        expect(TICKER_ITEMS.map((i) => i.ticker)).toEqual(['VALR3', 'BNDD4', 'SINT11', 'VALR3F', 'BNDD3', 'TJLO11'])
    })

    it('o resumo lista os códigos', () => {
        expect(tickerDecoderSummary({})).toMatch(/VALR3, BNDD4/)
    })
})
