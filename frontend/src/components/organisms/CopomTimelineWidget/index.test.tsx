import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CopomTimelineWidget } from '.'

describe('CopomTimelineWidget', () => {
    it('mostra oito reuniões e troca o detalhe ao selecionar', () => {
        render(<CopomTimelineWidget />)

        expect(screen.getAllByRole('button')).toHaveLength(8)
        expect(screen.getByText('Reunião 1 de 8')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '5' }))
        expect(screen.getByText('Reunião 5 de 8')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'true')
    })
})
