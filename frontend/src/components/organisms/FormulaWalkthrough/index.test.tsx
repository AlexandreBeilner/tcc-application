import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormulaWalkthrough, formulaWalkthroughSummary } from '.'

const props = {
    intro: 'A taxa é a mesma.',
    items: [
        {
            label: 'Juros simples',
            formula: 'M = C × (1 + i × n)',
            legend: 'C é o capital.',
            numbers: 'M = 1.000 × (1 + 0,10 × 3)',
            result: 'R$ 1.300',
        },
    ],
    note: 'O tempo é o ingrediente.',
}

describe('FormulaWalkthrough', () => {
    it('mostra a fórmula, a conta com os números e o resultado no mesmo cartão', () => {
        render(<FormulaWalkthrough {...props} />)
        expect(screen.getByText('M = C × (1 + i × n)')).toBeInTheDocument()
        expect(screen.getByText('M = 1.000 × (1 + 0,10 × 3)')).toBeInTheDocument()
        expect(screen.getByText('R$ 1.300')).toBeInTheDocument()
        expect(screen.getByText('O tempo é o ingrediente.')).toBeInTheDocument()
    })

    it('o resumo textual traz fórmula, números e resultado', () => {
        const summary = formulaWalkthroughSummary(props)
        expect(summary).toContain('M = C × (1 + i × n)')
        expect(summary).toContain('M = 1.000 × (1 + 0,10 × 3)')
        expect(summary).toContain('R$ 1.300')
    })
})
