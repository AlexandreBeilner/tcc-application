import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from '.'

describe('BrandLogo', () => {
    it('expõe o nome da marca uma única vez para leitores de tela', () => {
        render(<BrandLogo />)
        expect(screen.getAllByRole('img', { hidden: false })).toHaveLength(1)
        expect(screen.getByRole('img', { name: 'Selucra' })).toBeInTheDocument()
    })

    it('compactOnMobile acrescenta o ícone e o selo fica no canto da logo', () => {
        render(<BrandLogo compactOnMobile badge={<span>PRO</span>} />)
        expect(screen.getAllByRole('img', { name: 'Selucra' })).toHaveLength(2)
        expect(screen.getByText('PRO')).toBeInTheDocument()
    })
})
