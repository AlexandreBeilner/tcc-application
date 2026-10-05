import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BotCoverageEditor } from '.'

const options = [
    { asset_id: 'a1', ticker: 'AAA3' },
    { asset_id: 'a2', ticker: 'BBB3' },
]

function renderEditor(overrides: Partial<Parameters<typeof BotCoverageEditor>[0]> = {}) {
    const props = {
        options,
        selected: ['a1'],
        onSelectedChange: vi.fn(),
        maxCovered: '10',
        onMaxCoveredChange: vi.fn(),
        ...overrides,
    }
    render(<BotCoverageEditor {...props} />)
    return props
}

describe('BotCoverageEditor', () => {
    it('marca os ativos selecionados e conta quantos são', () => {
        renderEditor()
        expect(screen.getByRole('checkbox', { name: 'AAA3' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'BBB3' })).not.toBeChecked()
        expect(screen.getByText('Ativos cobertos (1 selecionados)')).toBeInTheDocument()
    })

    it('marcar e desmarcar devolve o conjunto final', () => {
        const props = renderEditor()
        fireEvent.click(screen.getByRole('checkbox', { name: 'BBB3' }))
        expect(props.onSelectedChange).toHaveBeenLastCalledWith(['a1', 'a2'])
        fireEvent.click(screen.getByRole('checkbox', { name: 'AAA3' }))
        expect(props.onSelectedChange).toHaveBeenLastCalledWith([])
    })

    it('edita o teto e mostra o erro dele', () => {
        const props = renderEditor({ maxError: 'Há 3 ativos selecionados, acima do teto.' })
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '2' } })
        expect(props.onMaxCoveredChange).toHaveBeenCalledWith('2')
        expect(screen.getByRole('alert')).toHaveTextContent('acima do teto')
    })

    it('sem ativo disponível explica o motivo', () => {
        renderEditor({ options: [], selected: [] })
        expect(screen.getByText(/todos já são cobertos por outros Market Makers/)).toBeInTheDocument()
    })
})
