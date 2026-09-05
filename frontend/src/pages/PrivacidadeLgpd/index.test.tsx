import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { deleteAccount, exportAccountData } from '../../services/auth'
import { PrivacidadeLgpd } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/auth', () => ({ deleteAccount: vi.fn(), exportAccountData: vi.fn() }))

function renderPage() {
    const router = createMemoryRouter(
        [
            { path: '/configuracoes/privacidade', element: <PrivacidadeLgpd /> },
            { path: '/login', element: <p>tela de login</p> },
        ],
        { initialEntries: ['/configuracoes/privacidade'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('PrivacidadeLgpd (tela 9.3)', () => {
    const logout = vi.fn()

    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'ana@x.com', username: 'ana', role: 'user', onboardingCompleted: true, avatarUrl: null },
            isLoading: false,
            login: vi.fn(),
            logout,
            setUser: vi.fn(),
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('exporta os dados chamando GET /me/export', async () => {
        vi.mocked(exportAccountData).mockResolvedValue({ export: { user: { id: 'u1' } } })
        const createObjectURL = vi.fn(() => 'blob:fake')
        const revokeObjectURL = vi.fn()
        vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Exportar dados' }))

        await waitFor(() => expect(exportAccountData).toHaveBeenCalledWith('token'))
        expect(createObjectURL).toHaveBeenCalled()

        vi.unstubAllGlobals()
    })

    it('exige a palavra-chave digitada antes de habilitar a exclusão (6.10.5)', async () => {
        vi.mocked(deleteAccount).mockResolvedValue(undefined)

        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))

        expect(deleteAccount).not.toHaveBeenCalled()
        expect(screen.getByText('Tem certeza? Esta ação é irreversível.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Digite EXCLUIR para confirmar a exclusão'), { target: { value: 'exclu' } })
        expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Digite EXCLUIR para confirmar a exclusão'), { target: { value: 'EXCLUIR' } })
        expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeEnabled()

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

        await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('token'))
        await waitFor(() => expect(logout).toHaveBeenCalled())
        expect(await screen.findByText('tela de login')).toBeInTheDocument()
    })

    it('cancelar a confirmação não chama a API e limpa o texto digitado', () => {
        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
        fireEvent.change(screen.getByLabelText('Digite EXCLUIR para confirmar a exclusão'), { target: { value: 'EXCLUIR' } })
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

        expect(deleteAccount).not.toHaveBeenCalled()
        expect(screen.queryByText('Tem certeza? Esta ação é irreversível.')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
        expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeDisabled()
    })
})
