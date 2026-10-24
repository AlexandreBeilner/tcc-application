import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TICKER_ITEMS, TickerDecoderWidget, tickerDecoderSummary } from '.'

describe('TickerDecoderWidget', () => {
    it('acerto mostra a regra do final do ticker', () => {
        render(<TickerDecoderWidget />)
        fireEvent.click(within(screen.getByRole('group', { name: 'O que é VALR3?' })).getByRole('button', { name: 'Ordinária (ON)' }))

        const feedback = screen.getByText('Certo.').closest('p') as HTMLElement
        expect(feedback).toHaveTextContent('Certo. Final 3: ação ordinária')
        expect(feedback.className).toMatch(/feedbackCorrect/)
        expect(screen.getByText('Você acertou 1 de 1 resposta.')).toBeInTheDocument()
    })

    it('erro diz a resposta certa', () => {
        render(<TickerDecoderWidget />)
        fireEvent.click(within(screen.getByRole('group', { name: 'O que é VALR3F?' })).getByRole('button', { name: 'Ordinária (ON)' }))

        const feedback = screen.getByText(/Não é isso, é Mercado fracionário/).closest('p') as HTMLElement
        expect(feedback.className).toMatch(/feedbackWrong/)
        // O botão escolhido fica marcado como erro; a cor nunca é a única pista (o texto diz a resposta certa).
        const chosen = within(screen.getByRole('group', { name: 'O que é VALR3F?' })).getByRole('button', { name: 'Ordinária (ON)' })
        expect(chosen).toHaveAttribute('aria-pressed', 'true')
        expect(chosen.className).toMatch(/presetWrong/)
    })

    it('o catálogo usa só tickers de exemplo', () => {
        expect(TICKER_ITEMS.map((i) => i.ticker)).toEqual(['VALR3', 'BNDD4', 'SINT11', 'VALR3F', 'BNDD3', 'TJLO11'])
    })

    it('o resumo lista os códigos', () => {
        expect(tickerDecoderSummary({})).toMatch(/VALR3, BNDD4/)
    })
})
