import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Delta } from '.'

describe('Delta', () => {
    it('alta: sinal +, seta para cima e rótulo falado', () => {
        render(<Delta percent={2} />)
        const el = screen.getByLabelText('alta de 2,0 por cento')
        expect(el.textContent).toContain('▲')
        expect(el.textContent).toContain('+2,0%')
    })

    it('queda: sinal −, seta para baixo', () => {
        render(<Delta percent={-1.26} />)
        const el = screen.getByLabelText('queda de 1,3 por cento')
        expect(el.textContent).toContain('▼')
        expect(el.textContent).toContain('−1,3%')
    })

    it('zero (inclusive o que arredonda para zero) é neutro, sem seta nem sinal', () => {
        const { container } = render(<Delta percent={-0.04} />)
        expect(container.textContent).toBe('0,0%')
        expect(screen.getByLabelText('sem variação, 0,0 por cento')).toBeTruthy()
    })

    it('indefinido vira travessão', () => {
        const { container, rerender } = render(<Delta percent={null} />)
        expect(container.textContent).toBe('—')
        rerender(<Delta />)
        expect(container.textContent).toBe('—')
    })

    it('kind flow fala entrada e saída', () => {
        render(<Delta amount={-50} kind="flow" />)
        expect(screen.getByLabelText('saída de R$ 50,00')).toBeTruthy()
    })

    it('valor em reais com sinal, sozinho ou junto do percentual', () => {
        const { container, rerender } = render(<Delta amount={-12.5} />)
        expect(container.textContent).toContain('−')
        expect(container.textContent).toContain('12,50')
        rerender(<Delta percent={3} amount={30} />)
        expect(container.textContent).toContain('+3,0%')
        expect(container.textContent).toContain('+')
    })
})
