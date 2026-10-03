import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reauthenticate } from '../../../services/auth'
import { ApiError, REAUTH_REQUIRED } from '../../../services/client'
import { useAuth } from '../../auth/AuthContext'
import { AdminReauthProvider, ReauthCancelledError, useAdminReauth } from '.'

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/auth', () => ({ reauthenticate: vi.fn() }))

const login = vi.fn()

function Harness({ run, onResult }: { run: (token: string) => Promise<string>; onResult: (value: string | Error) => void }) {
    const { withReauth } = useAdminReauth()
    return (
        <button
            type="button"
            onClick={() =>
                withReauth(run).then(
                    (value) => onResult(value),
                    (err: Error) => onResult(err),
                )
            }
        >
            executar
        </button>
    )
}

function setup(run: (token: string) => Promise<string>) {
    const onResult = vi.fn()
    render(
        <AdminReauthProvider>
            <Harness run={run} onResult={onResult} />
        </AdminReauthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'executar' }))
    return onResult
}

const reauthRequired = () => new ApiError(401, REAUTH_REQUIRED)

describe('AdminReauthProvider (N.22)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'velho', user: null, login } as unknown as ReturnType<typeof useAuth>)
    })
    afterEach(() => {
        vi.resetAllMocks()
        login.mockReset()
    })

    it('sem reauth_required, roda uma vez com o token atual e não abre a janela', async () => {
        const run = vi.fn().mockResolvedValue('ok')
        const onResult = setup(run)
        await waitFor(() => expect(onResult).toHaveBeenCalledWith('ok'))
        expect(run).toHaveBeenCalledWith('velho')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('com reauth_required, pede a senha, troca o token e repete a ação com o novo', async () => {
        const run = vi.fn().mockRejectedValueOnce(reauthRequired()).mockResolvedValueOnce('feito')
        vi.mocked(reauthenticate).mockResolvedValue({ token: 'novo' })
        const onResult = setup(run)

        fireEvent.change(await screen.findByLabelText('Senha'), { target: { value: 'senha-forte-123' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

        await waitFor(() => expect(onResult).toHaveBeenCalledWith('feito'))
        expect(reauthenticate).toHaveBeenCalledWith('velho', 'senha-forte-123')
        expect(login).toHaveBeenCalledWith('novo', undefined)
        expect(run).toHaveBeenNthCalledWith(2, 'novo')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('senha incorreta mantém a janela aberta com o aviso e não repete a ação', async () => {
        const run = vi.fn().mockRejectedValue(reauthRequired())
        vi.mocked(reauthenticate).mockRejectedValue(new ApiError(401, 'senha incorreta'))
        setup(run)

        fireEvent.change(await screen.findByLabelText('Senha'), { target: { value: 'errada' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.')
        expect(run).toHaveBeenCalledTimes(1)
        expect(login).not.toHaveBeenCalled()
    })

    it('cancelar a janela rejeita a ação com ReauthCancelledError', async () => {
        const run = vi.fn().mockRejectedValue(reauthRequired())
        const onResult = setup(run)

        fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

        await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.any(ReauthCancelledError)))
        expect(run).toHaveBeenCalledTimes(1)
    })

    it('outros erros passam direto, sem janela de senha', async () => {
        const run = vi.fn().mockRejectedValue(new ApiError(409, 'tick em andamento'))
        const onResult = setup(run)
        await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ message: 'tick em andamento' })))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
