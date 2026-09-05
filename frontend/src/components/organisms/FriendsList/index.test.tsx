import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import type { Friend } from '../../../services/friendships'
import { removeFriendship } from '../../../services/friendships'
import { FriendsList } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/friendships', () => ({ removeFriendship: vi.fn() }))

function renderList(friends: Friend[], props: { page?: number; totalPages?: number; onPageChange?: (page: number) => void } = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: (
                    <FriendsList
                        friends={friends}
                        page={props.page ?? 1}
                        totalPages={props.totalPages ?? 1}
                        onPageChange={props.onPageChange ?? vi.fn()}
                    />
                ),
            },
            { path: '/amigos/buscar', element: <div>tela de busca</div> },
            { path: '/perfil/:id', element: <div>perfil público</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

const bia: Friend = { friendshipId: 'f1', userId: 'u2', username: 'bia', name: 'Bia Souza', friendsSince: '2026-02-10T00:00:00.000Z' }

describe('FriendsList (tela 8.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    it('estado vazio mostra CTA que leva direto pra Buscar Amigos (8.2)', () => {
        renderList([])

        expect(screen.getByText(/ainda não tem amigos/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Buscar amigos' }))
        expect(screen.getByText('tela de busca')).toBeInTheDocument()
    })

    it('lista os amigos e navega pro perfil público ao clicar', () => {
        renderList([bia])

        expect(screen.getByText('Bia Souza')).toBeInTheDocument()
        expect(screen.getByText('@bia')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Bia Souza/ }))
        expect(screen.getByText('perfil público')).toBeInTheDocument()
    })

    it('não mostra paginação com 1 página só', () => {
        renderList([bia], { page: 1, totalPages: 1 })
        expect(screen.queryByRole('navigation', { name: 'Paginação de amigos' })).not.toBeInTheDocument()
    })

    it('mostra paginação com mais de 1 página e aciona onPageChange', () => {
        const onPageChange = vi.fn()
        renderList([bia], { page: 1, totalPages: 2, onPageChange })

        fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
        expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('desfazer amizade exige confirmação em duas etapas e chama a mutation (6.9.3)', async () => {
        vi.mocked(removeFriendship).mockResolvedValue(undefined)
        renderList([bia])

        fireEvent.click(screen.getByRole('button', { name: 'Desfazer amizade' }))
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        expect(screen.getByRole('button', { name: 'Desfazer amizade' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Desfazer amizade' }))
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
        await waitFor(() => expect(removeFriendship).toHaveBeenCalledWith('token', 'f1'))
    })
})
