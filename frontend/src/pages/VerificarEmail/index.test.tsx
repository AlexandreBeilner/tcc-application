import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/client'
import { resendVerification, verifyEmail } from '../../services/auth'
import { VerificarEmail } from '.'

vi.mock('../../services/auth', () => ({
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
}))

function renderPage() {
    const router = createMemoryRouter(
        [
            { path: '/verificar-email', element: <VerificarEmail /> },
            { path: '/login', element: <div>tela de entrada</div> },
        ],
        { initialEntries: ['/verificar-email'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('VerificarEmail (tela 1.5)', () => {
    afterEach(() => {
        vi.clearAllMocks()
        window.location.hash = ''
    })

    it('consome o token do fragmento uma vez só e leva à entrada depois de confirmar', async () => {
        window.location.hash = '#token=abc123'
        vi.mocked(verifyEmail).mockResolvedValue({ message: 'ok' })

        renderPage()

        expect(await screen.findByText('Pronto, seu e-mail foi confirmado')).toBeInTheDocument()
        expect(verifyEmail).toHaveBeenCalledTimes(1)
        expect(verifyEmail).toHaveBeenCalledWith('abc123')
        expect(window.location.hash).toBe('')

        fireEvent.click(screen.getByRole('button', { name: 'Ir para a entrada' }))
        expect(await screen.findByText('tela de entrada')).toBeInTheDocument()
    })

    it('link expirado (410) mostra "não vale mais" com o reenvio sempre visível', async () => {
        window.location.hash = '#token=velho'
        vi.mocked(verifyEmail).mockRejectedValue(new ApiError(410, 'token_expired'))
        vi.mocked(resendVerification).mockResolvedValue({ message: 'ok' })

        renderPage()

        expect(await screen.findByText('Este link não vale mais')).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('E-mail da conta'), { target: { value: 'ana@example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }))
        await waitFor(() => expect(resendVerification).toHaveBeenCalledWith('ana@example.com'))
    })

    it('link já usado (410 token_used) tem texto próprio e ainda oferece reenviar', async () => {
        window.location.hash = '#token=usado'
        vi.mocked(verifyEmail).mockRejectedValue(new ApiError(410, 'token_used'))

        renderPage()

        expect(await screen.findByText('Este link já foi usado')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' })).toBeInTheDocument()
    })

    it('token desconhecido (401) e link sem token caem em "não vale mais" sem chamar a API sem token', async () => {
        window.location.hash = ''
        renderPage()
        expect(await screen.findByText('Este link não vale mais')).toBeInTheDocument()
        expect(verifyEmail).not.toHaveBeenCalled()
    })

    it('erro de rede/5xx não diz que o link morreu: oferece tentar de novo', async () => {
        window.location.hash = '#token=abc'
        vi.mocked(verifyEmail).mockRejectedValue(new ApiError(500, 'erro interno'))

        renderPage()

        expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
        expect(screen.queryByText('Este link não vale mais')).not.toBeInTheDocument()
    })
})
