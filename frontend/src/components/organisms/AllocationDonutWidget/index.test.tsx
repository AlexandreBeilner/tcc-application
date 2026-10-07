import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AllocationDonutWidget, allocationDonutSummary } from '.'

const props = { profile: 'moderate', amount: 10000 } as const

describe('AllocationDonutWidget', () => {
    it('começa pelo exemplo do perfil e a soma fecha em 100%', () => {
        render(<AllocationDonutWidget {...props} />)
        expect(screen.getByText('A soma fecha em 100%.')).toBeInTheDocument()
        expect(screen.getByText(/Ações e ETFs: 25%/)).toBeInTheDocument()
    })

    it('trocar para arrojado aumenta a perda do ano ruim', () => {
        render(<AllocationDonutWidget {...props} />)
        const before = screen.getByText(/perde cerca de/).textContent
        fireEvent.click(screen.getByRole('button', { name: 'Arrojado' }))
        expect(screen.getByText(/perde cerca de/).textContent).not.toBe(before)
        expect(screen.getByText(/Ações e ETFs: 55%/)).toBeInTheDocument()
    })

    it('soma diferente de 100% avisa', () => {
        render(<AllocationDonutWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Ações e ETFs/), { target: { value: '50' } })
        expect(screen.getByText(/A soma está em 125%/)).toBeInTheDocument()
    })

    it('o resumo textual descreve o gráfico', () => {
        expect(allocationDonutSummary(props)).toMatch(/ano ruim ilustrativo/)
    })
})
