import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../services/client'
import { resendVerification } from '../../../services/auth'
import { ResendVerification } from '.'

vi.mock('../../../services/auth', () => ({ resendVerification: vi.fn() }))

describe('ResendVerification', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('com e-mail conhecido mostra só o botão e reenvia para ele', async () => {
        vi.mocked(resendVerification).mockResolvedValue({ message: 'ok' })
        render(<ResendVerification email="ana@example.com" />)

        expect(screen.queryByLabelText('E-mail da conta')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }))

        await waitFor(() => expect(resendVerification).toHaveBeenCalledWith('ana@example.com'))
        expect(await screen.findByRole('status')).toHaveTextContent('enviamos um novo link')
    })

    it('sem e-mail conhecido pede o e-mail antes de reenviar', async () => {
        vi.mocked(resendVerification).mockResolvedValue({ message: 'ok' })
        render(<ResendVerification />)

        fireEvent.change(screen.getByLabelText('E-mail da conta'), { target: { value: 'bia@example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }))

        await waitFor(() => expect(resendVerification).toHaveBeenCalledWith('bia@example.com'))
    })

    it('limite de pedidos (429) mostra mensagem própria', async () => {
        vi.mocked(resendVerification).mockRejectedValue(new ApiError(429, 'muitas requisições'))
        render(<ResendVerification email="ana@example.com" />)

        fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Você pediu links demais')
    })
})
