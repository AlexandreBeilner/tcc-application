import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NotFound } from '.'

describe('NotFound', () => {
    it('explica que a página não existe e oferece o caminho de volta', () => {
        render(
            <MemoryRouter>
                <NotFound />
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/')
    })
})
