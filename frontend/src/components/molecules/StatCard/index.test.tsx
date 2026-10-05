import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { StatCard, StatFact } from '.'

describe('StatCard', () => {
    it('mostra título, números e o link pra seção', () => {
        render(
            <MemoryRouter>
                <StatCard title="Mercado" to="/admin/mercado" linkLabel="Abrir monitor">
                    <StatFact label="Dia simulado" value="120" />
                </StatCard>
            </MemoryRouter>,
        )
        expect(screen.getByRole('heading', { name: 'Mercado' })).toBeInTheDocument()
        expect(screen.getByText('Dia simulado')).toBeInTheDocument()
        expect(screen.getByText('120')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Abrir monitor' })).toHaveAttribute('href', '/admin/mercado')
    })

    it('fonte fora do ar troca os números pelo motivo', () => {
        render(
            <MemoryRouter>
                <StatCard title="Produto" unavailable="banco fora">
                    <StatFact label="Usuários" value="42" />
                </StatCard>
            </MemoryRouter>,
        )
        expect(screen.getByRole('status')).toHaveTextContent('Indisponível: banco fora')
        expect(screen.queryByText('Usuários')).not.toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
})
