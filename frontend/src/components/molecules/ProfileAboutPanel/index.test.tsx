import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProfileAboutPanel } from '.'

describe('ProfileAboutPanel (tarefa 6.9.5)', () => {
    it('mostra a nota de privacidade e o link pra Classificação', () => {
        render(
            <MemoryRouter>
                <ProfileAboutPanel />
            </MemoryRouter>,
        )

        expect(screen.getByText('Sobre este perfil')).toBeInTheDocument()
        expect(
            screen.getByText('Rentabilidade, nível e conquistas são sempre visíveis. Patrimônio nunca é exposto a outros usuários.'),
        ).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Ver na Classificação/ })).toHaveAttribute('href', '/classificacao')
    })
})
