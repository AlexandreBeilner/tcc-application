import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Friend } from '../../../services/friendships'
import { FriendsList } from '.'

function renderList(friends: Friend[]) {
    const router = createMemoryRouter(
        [
            { path: '/', element: <FriendsList friends={friends} /> },
            { path: '/amigos/buscar', element: <div>tela de busca</div> },
            { path: '/perfil/:id', element: <div>perfil público</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('FriendsList (tela 8.1)', () => {
    it('estado vazio mostra CTA que leva direto pra Buscar Amigos (8.2)', () => {
        renderList([])

        expect(screen.getByText(/ainda não tem amigos/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Buscar amigos' }))
        expect(screen.getByText('tela de busca')).toBeInTheDocument()
    })

    it('lista os amigos e navega pro perfil público ao clicar', () => {
        renderList([{ userId: 'u2', username: 'bia', name: 'Bia Souza', friendsSince: '2026-02-10T00:00:00.000Z' }])

        expect(screen.getByText('Bia Souza')).toBeInTheDocument()
        expect(screen.getByText('@bia')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Bia Souza/ }))
        expect(screen.getByText('perfil público')).toBeInTheDocument()
    })
})
