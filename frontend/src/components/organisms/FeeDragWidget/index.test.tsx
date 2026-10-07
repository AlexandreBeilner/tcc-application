import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FeeDragWidget, feeDragSummary } from '.'

const props = { initial: 10000, monthly: 0, grossReturnPct: 10, feeAPct: 0, feeBPct: 2, years: 20 }

describe('FeeDragWidget', () => {
    it('mostra o custo da taxa maior em reais e a fatia do ganho consumida', () => {
        render(<FeeDragWidget {...props} />)

        expect(screen.getByText(/A taxa maior custa R\$\s*\d.* em 20 anos/)).toBeInTheDocument()
        expect(screen.getByText(/Isso consome \d+,\d% do ganho do produto A/)).toBeInTheDocument()
    })

    it('taxas iguais dizem que os dois terminam iguais', () => {
        render(<FeeDragWidget {...props} feeBPct={0} />)

        expect(screen.getByText(/mesmo saldo/)).toBeInTheDocument()
    })

    it('subir a taxa do produto A acima da do B inverte a leitura', () => {
        render(<FeeDragWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Taxa do produto A/), { target: { value: '3' } })

        expect(screen.getByText(/a taxa menor é a do produto B/)).toBeInTheDocument()
    })

    it('o resumo textual descreve taxas, prazo e aporte', () => {
        expect(feeDragSummary(props)).toMatch(/taxas de 0,00% e 2,00%.*prazo de 20 anos/)
    })
})
