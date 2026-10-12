import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/client'
import { requestPasswordReset } from '../../services/auth'
import { EsqueciSenha } from '.'

vi.mock('../../services/auth', () => ({
    requestPasswordReset: vi.fn(),
}))

function renderPage() {
    const router = createMemoryRouter(
        [
            { path: '/esqueci-senha', element: <EsqueciSenha /> },
            { path: '/login', element: <div>tela de entrada</div> },
        ],
        { initialEntries: ['/esqueci-senha'] },
    )
    return render(<RouterProvider router={router} />)
}

function submit(email: string) {
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
}

describe('EsqueciSenha (EM.2.3)', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('envia o e-mail e mostra o aviso neutro, sem dizer se a conta existe', async () => {
        vi.mocked(requestPasswordReset).mockResolvedValue({ message: 'ok' })
        renderPage()

        submit('ana@example.com')

        expect(await screen.findByText(/Se existir uma conta com o e-mail ana@example.com/)).toBeInTheDocument()
        expect(requestPasswordReset).toHaveBeenCalledWith('ana@example.com')
        expect(screen.queryByText(/não encontrado/i)).not.toBeInTheDocument()
    })

    it('"Pedir outro link" volta ao formulário', async () => {
        vi.mocked(requestPasswordReset).mockResolvedValue({ message: 'ok' })
        renderPage()
        submit('ana@example.com')

        fireEvent.click(await screen.findByRole('button', { name: 'Pedir outro link' }))

        expect(screen.getByRole('button', { name: 'Enviar link' })).toBeInTheDocument()
    })

    it('limite de pedidos (429) vira mensagem própria', async () => {
        vi.mocked(requestPasswordReset).mockRejectedValue(new ApiError(429, 'muitas requisições, tente novamente em instantes'))
        renderPage()

        submit('ana@example.com')

        expect(await screen.findByRole('alert')).toHaveTextContent('pedidos demais')
    })

    it('erro de servidor mostra a mensagem genérica da tela', async () => {
        vi.mocked(requestPasswordReset).mockRejectedValue(new ApiError(500, 'erro inesperado'))
        renderPage()

        submit('ana@example.com')

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível enviar o pedido'))
    })

    it('tem o caminho de volta para a entrada', () => {
        renderPage()

        expect(screen.getByRole('link', { name: 'Voltar para a entrada' })).toHaveAttribute('href', '/login')
    })
})
