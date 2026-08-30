import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GrowthCalculatorForm } from '.'

describe('GrowthCalculatorForm', () => {
    it('mostra resultado com os valores default (capital, aporte, taxa, período)', () => {
        render(<GrowthCalculatorForm />)
        expect(screen.getAllByText('Total investido').length).toBeGreaterThan(0)
        expect(screen.getByText('Total em juros')).toBeInTheDocument()
        expect(screen.getByText('Total final')).toBeInTheDocument()
    })

    it('alternar pra "Juros simples" muda o resultado calculado', () => {
        render(<GrowthCalculatorForm />)
        const compoundTotal = screen.getByText('Total final').closest('div')!.textContent
        fireEvent.click(screen.getByText('Juros simples'))
        const simpleTotal = screen.getByText('Total final').closest('div')!.textContent
        expect(simpleTotal).not.toBe(compoundTotal)
    })

    it('período zerado esconde o gráfico e mostra uma dica', () => {
        render(<GrowthCalculatorForm />)
        fireEvent.change(screen.getByLabelText('Período (meses)'), { target: { value: '0' } })
        expect(screen.getByText('Informe um período maior que zero pra ver a projeção.')).toBeInTheDocument()
    })
})
