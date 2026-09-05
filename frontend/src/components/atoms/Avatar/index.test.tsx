import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from '.'

describe('Avatar', () => {
    it('mostra a inicial maiúscula do username', () => {
        render(<Avatar username="bia" />)

        expect(screen.getByText('B')).toBeInTheDocument()
    })

    it('size="lg" renderiza sem erro, com a mesma inicial', () => {
        render(<Avatar username="ana" size="lg" />)

        expect(screen.getByText('A')).toBeInTheDocument()
    })
})
