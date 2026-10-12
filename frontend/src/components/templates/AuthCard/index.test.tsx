import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthCard } from '.'

describe('AuthCard', () => {
    it('mostra a marca, o subtítulo e o conteúdo', () => {
        render(
            <AuthCard subtitle="Recuperar senha">
                <p>conteúdo da tela</p>
            </AuthCard>,
        )

        expect(screen.getByRole('heading', { name: 'Selucra' })).toBeInTheDocument()
        expect(screen.getByText('Recuperar senha')).toBeInTheDocument()
        expect(screen.getByText('conteúdo da tela')).toBeInTheDocument()
    })
})
