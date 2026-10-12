import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DistributionChart } from '.'

const slices = [
    { category: 'tesouro' as const, label: 'Tesouro Direto', value: 6000, percentage: 0.6 },
    { category: 'acao' as const, label: 'Ações', value: 3000, percentage: 0.3 },
    { category: 'fii' as const, label: 'FIIs', value: 1000, percentage: 0.1 },
]

function hole() {
    return document.querySelector('[aria-live="polite"]') as HTMLElement
}

function norm(text: string | null) {
    return (text ?? '').replace(/ /g, ' ')
}

describe('DistributionChart', () => {
    it('mostra o total no furo e R$ e % de cada fatia na legenda', () => {
        render(<DistributionChart slices={slices} />)

        expect(norm(hole().textContent)).toContain('Total investido')
        expect(norm(hole().textContent)).toContain('R$ 10.000,00')
        const tesouro = screen.getByRole('button', { name: /Tesouro Direto/ })
        expect(norm(tesouro.getAttribute('aria-label'))).toBe('Tesouro Direto: R$ 6.000,00, 60.0% da carteira')
        expect(norm(tesouro.textContent)).toContain('R$ 6.000,00')
        expect(tesouro.textContent).toContain('60.0%')
    })

    it('hover na fatia mostra o valor dela no furo e volta ao total ao sair', () => {
        const { container } = render(<DistributionChart slices={slices} />)
        const arcs = container.querySelectorAll('circle')

        fireEvent.mouseEnter(arcs[1])
        expect(norm(hole().textContent)).toContain('Ações')
        expect(norm(hole().textContent)).toContain('R$ 3.000,00')
        expect(hole().textContent).toContain('30.0%')

        fireEvent.mouseLeave(arcs[1])
        expect(norm(hole().textContent)).toContain('Total investido')
    })

    it('clique/toque fixa a fatia, clicar de novo desfaz e Esc limpa', () => {
        render(<DistributionChart slices={slices} />)
        const fii = screen.getByRole('button', { name: /FIIs/ })

        fireEvent.click(fii)
        expect(fii).toHaveAttribute('aria-pressed', 'true')
        expect(norm(hole().textContent)).toContain('R$ 1.000,00')

        fireEvent.click(fii)
        expect(fii).toHaveAttribute('aria-pressed', 'false')
        expect(norm(hole().textContent)).toContain('Total investido')

        fireEvent.click(fii)
        fireEvent.keyDown(fii, { key: 'Escape' })
        expect(fii).toHaveAttribute('aria-pressed', 'false')
        expect(norm(hole().textContent)).toContain('Total investido')
    })

    it('setas movem o foco entre as categorias da legenda e Enter fixa', () => {
        render(<DistributionChart slices={slices} />)
        const tesouro = screen.getByRole('button', { name: /Tesouro Direto/ })

        tesouro.focus()
        fireEvent.keyDown(tesouro, { key: 'ArrowDown' })
        const acoes = screen.getByRole('button', { name: /Ações/ })
        expect(acoes).toHaveFocus()
        fireEvent.keyDown(acoes, { key: 'ArrowUp' })
        fireEvent.keyDown(tesouro, { key: 'ArrowUp' })
        expect(screen.getByRole('button', { name: /FIIs/ })).toHaveFocus()
    })

    it('com onSelect, clicar na fatia ou na linha da legenda navega em vez de fixar o destaque', () => {
        const onSelect = vi.fn()
        const { container } = render(<DistributionChart slices={slices} onSelect={onSelect} />)

        fireEvent.click(container.querySelectorAll('circle')[1])
        fireEvent.click(screen.getByRole('button', { name: /FIIs/ }))

        expect(onSelect).toHaveBeenNthCalledWith(1, 'acao')
        expect(onSelect).toHaveBeenNthCalledWith(2, 'fii')
        expect(screen.getByRole('button', { name: /FIIs/ })).not.toHaveAttribute('aria-pressed')
    })

    it('com onSelect, focar a linha destaca a fatia no furo (sem depender de mouse)', () => {
        render(<DistributionChart slices={slices} onSelect={() => {}} />)

        fireEvent.focus(screen.getByRole('button', { name: /Ações/ }))
        expect(norm(hole().textContent)).toContain('R$ 3.000,00')
    })
})
