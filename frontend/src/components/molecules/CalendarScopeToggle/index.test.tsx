import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarScopeToggle } from '.'

describe('CalendarScopeToggle', () => {
    it('marca o escopo atual e avisa a troca', () => {
        const onChange = vi.fn()
        render(<CalendarScopeToggle scope="mine" onChange={onChange} />)

        expect(screen.getByRole('radio', { name: 'Meus' })).toBeChecked()
        expect(screen.getByRole('radio', { name: 'Todos' })).not.toBeChecked()

        fireEvent.click(screen.getByRole('radio', { name: 'Todos' }))
        expect(onChange).toHaveBeenCalledWith('all')
    })
})
