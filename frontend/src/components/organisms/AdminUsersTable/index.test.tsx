import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { AdminUserSummary } from '../../../services/admin'
import { AdminUsersTable } from '.'

const user: AdminUserSummary = {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
    name: 'Maria Souza',
    email: 'maria@example.com',
    username: 'maria',
    role: 'user',
    status: 'active',
    onboarding_completed: true,
    providers: ['password', 'google'],
    created_at: '2026-10-01T12:00:00Z',
}

function renderTable(users: AdminUserSummary[]) {
    return render(
        <MemoryRouter>
            <AdminUsersTable users={users} emptyMessage="Nenhuma conta com esse filtro." />
        </MemoryRouter>,
    )
}

describe('AdminUsersTable', () => {
    it('mostra a mensagem vazia sem linhas', () => {
        renderTable([])
        expect(screen.getByText('Nenhuma conta com esse filtro.')).toBeInTheDocument()
    })

    it('liga cada conta ao detalhe e lista papel, status e provedores', () => {
        renderTable([user])
        const table = screen.getByRole('table')
        const link = within(table).getByRole('link', { name: 'Maria Souza' })
        expect(link).toHaveAttribute('href', `/admin/usuarios/${user.id}`)
        expect(within(table).getByText('@maria')).toBeInTheDocument()
        // 'Usuário' aparece no cabeçalho da coluna e no papel da linha.
        expect(within(table).getAllByText('Usuário')).toHaveLength(2)
        expect(within(table).getByText('Ativa')).toBeInTheDocument()
        expect(within(table).getByText('E-mail e senha, Google')).toBeInTheDocument()
    })

    it('conta suspensa mostra o selo escrito e conta excluída não mostra o nome antigo', () => {
        renderTable([
            { ...user, status: 'suspended' },
            { ...user, id: 'b', username: 'usuario-removido-6f9619ff', name: 'Usuário removido' },
        ])
        const table = screen.getByRole('table')
        expect(within(table).getByText('Suspensa')).toBeInTheDocument()
        expect(within(table).getByRole('link', { name: 'Conta excluída' })).toBeInTheDocument()
    })
})
