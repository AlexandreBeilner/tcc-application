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

    it('com avatarUrl mostra a foto em vez das iniciais (6.10.8)', () => {
        render(<Avatar username="bia" avatarUrl="/avatars/bia.jpg" />)

        expect(screen.queryByText('B')).not.toBeInTheDocument()
        const img = screen.getByRole('img')
        expect(img).toHaveAttribute('src', '/avatars/bia.jpg')
    })

    it('avatarUrl null cai no fallback de iniciais', () => {
        render(<Avatar username="bia" avatarUrl={null} />)

        expect(screen.getByText('B')).toBeInTheDocument()
    })
})
