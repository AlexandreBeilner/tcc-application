import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Select } from '.'

const options = [
    { value: 'all', label: 'Todos' },
    { value: 'buy', label: 'Compra' },
    { value: 'sell', label: 'Venda' },
]

describe('Select', () => {
    it('mostra o rótulo da opção selecionada no gatilho, fechado por padrão', () => {
        render(<Select aria-label="Tipo" value="buy" onChange={vi.fn()} options={options} />)

        expect(screen.getByRole('button', { name: 'Tipo' })).toHaveTextContent('Compra')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('clique no gatilho abre a lista de opções, estilizada (não o <select> nativo)', () => {
        render(<Select aria-label="Tipo" value="all" onChange={vi.fn()} options={options} />)

        fireEvent.click(screen.getByRole('button', { name: 'Tipo' }))
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        expect(screen.getAllByRole('option')).toHaveLength(3)
        expect(document.querySelector('select')).not.toBeInTheDocument()
    })

    it('clicar numa opção chama onChange e fecha a lista', () => {
        const onChange = vi.fn()
        render(<Select aria-label="Tipo" value="all" onChange={onChange} options={options} />)

        fireEvent.click(screen.getByRole('button', { name: 'Tipo' }))
        fireEvent.click(screen.getByRole('option', { name: 'Venda' }))

        expect(onChange).toHaveBeenCalledWith('sell')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('navegação por teclado: ArrowDown destaca a próxima opção, Enter seleciona', () => {
        const onChange = vi.fn()
        render(<Select aria-label="Tipo" value="all" onChange={onChange} options={options} />)

        fireEvent.click(screen.getByRole('button', { name: 'Tipo' }))
        const listbox = screen.getByRole('listbox')
        fireEvent.keyDown(listbox, { key: 'ArrowDown' })
        fireEvent.keyDown(listbox, { key: 'Enter' })

        expect(onChange).toHaveBeenCalledWith('buy')
    })

    it('Esc fecha a lista sem chamar onChange', () => {
        const onChange = vi.fn()
        render(<Select aria-label="Tipo" value="all" onChange={onChange} options={options} />)

        fireEvent.click(screen.getByRole('button', { name: 'Tipo' }))
        fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(onChange).not.toHaveBeenCalled()
    })

    it('clique fora fecha a lista sem chamar onChange', () => {
        render(
            <div>
                <Select aria-label="Tipo" value="all" onChange={vi.fn()} options={options} />
                <button type="button">fora</button>
            </div>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Tipo' }))
        expect(screen.getByRole('listbox')).toBeInTheDocument()

        fireEvent.pointerDown(screen.getByRole('button', { name: 'fora' }))
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
})
