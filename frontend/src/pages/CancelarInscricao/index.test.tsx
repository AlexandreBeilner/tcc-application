import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/client'
import { unsubscribeByToken } from '../../services/emailPreferences'
import { CancelarInscricao } from '.'

vi.mock('../../services/emailPreferences', () => ({ unsubscribeByToken: vi.fn() }))

function renderPage() {
    const router = createMemoryRouter([{ path: '/cancelar-inscricao', element: <CancelarInscricao /> }], {
        initialEntries: ['/cancelar-inscricao'],
    })
    return render(<RouterProvider router={router} />)
}

describe('CancelarInscricao (EM.6.1)', () => {
    afterEach(() => {
        vi.clearAllMocks()
        window.location.hash = ''
    })

    it('abrir a página não cancela nada: só o botão confirma, e o token sai da barra de endereço', async () => {
        window.location.hash = '#token=abc'
        vi.mocked(unsubscribeByToken).mockResolvedValue({ status: 'cancelado', category: 'social' })

        renderPage()

        expect(screen.getByText('Quer deixar de receber estes e-mails?')).toBeInTheDocument()
        expect(unsubscribeByToken).not.toHaveBeenCalled()
        expect(window.location.hash).toBe('')

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar inscrição' }))

        expect(await screen.findByText('Pronto, você não vai mais receber esses e-mails')).toBeInTheDocument()
        expect(unsubscribeByToken).toHaveBeenCalledWith('abc')
        expect(screen.getByText(/Desligamos os e-mails sobre amigos/)).toBeInTheDocument()
    })

    it('sem token no link mostra "link inválido"', () => {
        renderPage()

        expect(screen.getByText('Este link não funciona')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Cancelar inscrição' })).not.toBeInTheDocument()
    })

    it('token rejeitado pelo servidor (400) cai em "link inválido"', async () => {
        window.location.hash = '#token=adulterado'
        vi.mocked(unsubscribeByToken).mockRejectedValue(new ApiError(400, 'link de cancelamento inválido'))

        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar inscrição' }))

        expect(await screen.findByText('Este link não funciona')).toBeInTheDocument()
    })

    it('falha de rede mostra o erro e permite tentar de novo com o mesmo token', async () => {
        window.location.hash = '#token=abc'
        vi.mocked(unsubscribeByToken)
            .mockRejectedValueOnce(new Error('rede'))
            .mockResolvedValueOnce({ status: 'cancelado', category: 'engagement' })

        renderPage()
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar inscrição' }))
        expect(await screen.findByRole('alert')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar inscrição' }))

        expect(await screen.findByText(/Desligamos os e-mails de resumo e lembretes/)).toBeInTheDocument()
        expect(unsubscribeByToken).toHaveBeenCalledTimes(2)
    })
})
