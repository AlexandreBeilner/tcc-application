import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductComparatorWidget } from '.'

const products = [
    { name: 'CDB 12%', annualRatePct: 12, taxExempt: false, liquidity: 'No vencimento', fgc: 'Sim' },
    { name: 'LCI 9,5%', annualRatePct: 9.5, taxExempt: true, liquidity: 'Após carência', fgc: 'Sim' },
]

describe('ProductComparatorWidget', () => {
    it('em 60 dias a LCI isenta vence', () => {
        render(<ProductComparatorWidget products={products} amount={10000} days={60} />)

        expect(screen.getByText(/LCI 9,5% rende mais líquido em 60 dias/)).toBeInTheDocument()
        expect(screen.getByText('Após carência')).toBeInTheDocument()
    })

    it('em 720 dias o CDB vence', () => {
        render(<ProductComparatorWidget products={products} amount={10000} days={60} />)
        fireEvent.change(screen.getByLabelText('Prazo (dias)'), { target: { value: '720' } })

        expect(screen.getByText(/CDB 12% rende mais líquido em 720 dias/)).toBeInTheDocument()
    })

    it('valor zerado mostra aviso', () => {
        render(<ProductComparatorWidget products={products} amount={10000} days={60} />)
        fireEvent.change(screen.getByLabelText('Valor investido (R$)'), { target: { value: '' } })

        expect(screen.getByText('Informe valor e prazo maiores que zero.')).toBeInTheDocument()
    })
})
