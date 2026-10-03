import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AdminVisaoGeral } from '.'

describe('AdminVisaoGeral (tela 10.1)', () => {
    it('mostra as 8 seções além da própria Visão geral, com "Em breve" nas que ainda não têm tela', () => {
        render(
            <MemoryRouter>
                <AdminVisaoGeral />
            </MemoryRouter>,
        )
        expect(screen.getByRole('heading', { name: 'Painel Administrativo' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Mercado' })).toHaveAttribute('href', '/admin/eventos')
        expect(screen.getAllByText('Em breve')).toHaveLength(5)
        expect(screen.queryByRole('link', { name: 'Visão geral' })).not.toBeInTheDocument()
    })
})
