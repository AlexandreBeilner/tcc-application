import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Locked } from '.'

describe('Locked', () => {
    it('renderiza sem label visível quando nenhuma é passada', () => {
        render(<Locked size={20} />)

        expect(screen.queryByText('Lição 0.1')).not.toBeInTheDocument()
    })

    it('renderiza a label visível quando passada', () => {
        render(<Locked size={14} label="Lição 0.1" />)

        expect(screen.getByText('Lição 0.1')).toBeInTheDocument()
    })
})
