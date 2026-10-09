import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MtmSeesawWidget, mtmSeesawSummary } from '.'

const props = { contractRatePct: 11.75, yearsToMaturity: 2, indexer: 'prefixed' as const }

describe('MtmSeesawWidget', () => {
    it('começa nivelada, com o preço de compra', () => {
        render(<MtmSeesawWidget {...props} />)

        expect(screen.getByText(/Preço hoje: R\$\s800,76 \(compra: R\$\s800,76\), fica igual/)).toBeInTheDocument()
    })

    it('taxa sobe 2,25 p.p.: o preço cai', () => {
        render(<MtmSeesawWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Taxa de mercado: /), { target: { value: '14' } })

        expect(screen.getByText(/Preço hoje: R\$\s769,47.*cai 3,9\d%/)).toBeInTheDocument()
    })

    it('o cenário "Taxa cai 1 p.p." sobe o preço', () => {
        render(<MtmSeesawWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: 'Taxa cai 1 p.p.' }))

        expect(screen.getByText(/Preço hoje:.*sobe/)).toBeInTheDocument()
    })

    it('Selic quase não oscila com a mesma alta de taxa', () => {
        render(<MtmSeesawWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: 'Selic' }))
        fireEvent.click(screen.getByRole('button', { name: 'Taxa sobe 2,5 p.p.' }))

        expect(screen.getByText(/reprecificado todo dia/)).toBeInTheDocument()
        expect(screen.getByText(/cai 0,0\d%|fica igual/)).toBeInTheDocument()
    })

    it('o resumo descreve o título', () => {
        expect(mtmSeesawSummary(props)).toMatch(/Prefixado comprado a 11,75%/)
    })
})
