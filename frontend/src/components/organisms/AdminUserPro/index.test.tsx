import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminReauthProvider } from '../../../features/admin/AdminReauth'
import { useAuth } from '../../../features/auth/AuthContext'
import { getAdminUserPro, grantAdminUserPro } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { AdminUserPro } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/auth', () => ({ reauthenticate: vi.fn() }))
vi.mock('../../../services/admin', () => ({
    getAdminUserPro: vi.fn(),
    grantAdminUserPro: vi.fn(),
}))

const USER_ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff'

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminReauthProvider>
                    <AdminUserPro userId={USER_ID} username="maria" />
                </AdminReauthProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

function form() {
    return within(screen.getByRole('form', { name: 'Conceder PRO' }))
}

function fill(days: string, reason: string) {
    fireEvent.change(form().getByLabelText('Dias de PRO'), { target: { value: days } })
    fireEvent.change(form().getByLabelText('Motivo'), { target: { value: reason } })
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAdminUserPro).mockResolvedValue({ is_pro: false, state: 'none', plan: null, store: null, expires_at: null })
})

describe('AdminUserPro', () => {
    it('mostra o plano atual da pessoa', async () => {
        vi.mocked(getAdminUserPro).mockResolvedValue({
            is_pro: true,
            state: 'active',
            plan: 'monthly',
            store: 'promotional',
            expires_at: '2026-11-01T12:00:00.000Z',
        })
        renderPanel()
        expect(await screen.findByText('PRO ativo (mensal, concessão promocional)')).toBeInTheDocument()
    })

    it('sem plano mostra "Sem plano PRO"', async () => {
        renderPanel()
        expect(await screen.findByText('Sem plano PRO')).toBeInTheDocument()
    })

    it.each([
        ['zero dias', '0', 'parceria'],
        ['mais que o teto', '91', 'parceria'],
        ['texto', 'dez', 'parceria'],
        ['motivo curto', '10', 'ok'],
    ])('não habilita com %s', async (_name, days, reason) => {
        renderPanel()
        await screen.findByText('Sem plano PRO')
        fill(days, reason)
        expect(form().getByRole('button', { name: 'Conceder PRO' })).toBeDisabled()
    })

    it('pede confirmação, concede e mostra o fim do acesso', async () => {
        vi.mocked(grantAdminUserPro).mockResolvedValue({
            user_id: USER_ID,
            ends_at: '2026-11-10T15:00:00.000Z',
            previous_access_end: null,
        })
        renderPanel()
        await screen.findByText('Sem plano PRO')
        fill('30', 'parceria com a faculdade')
        fireEvent.click(form().getByRole('button', { name: 'Conceder PRO' }))

        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText(/30 dias/)).toBeInTheDocument()
        expect(grantAdminUserPro).not.toHaveBeenCalled()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Conceder' }))

        await waitFor(() =>
            expect(grantAdminUserPro).toHaveBeenCalledWith('tok', USER_ID, { days: 30, reason: 'parceria com a faculdade' }),
        )
        expect(await screen.findByRole('status')).toHaveTextContent('PRO concedido a @maria')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('erro do provedor aparece dentro do diálogo e a concessão não é dada como feita', async () => {
        vi.mocked(grantAdminUserPro).mockRejectedValue(new ApiError(502, 'x'))
        renderPanel()
        await screen.findByText('Sem plano PRO')
        fill('7', 'cortesia')
        fireEvent.click(form().getByRole('button', { name: 'Conceder PRO' }))
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Conceder' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Nada foi concedido')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('mensagem de conflito do backend (PRO sem vencimento) é repassada', async () => {
        vi.mocked(grantAdminUserPro).mockRejectedValue(new ApiError(409, 'esta pessoa já tem PRO sem vencimento'))
        renderPanel()
        await screen.findByText('Sem plano PRO')
        fill('7', 'cortesia')
        fireEvent.click(form().getByRole('button', { name: 'Conceder PRO' }))
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Conceder' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('já tem PRO sem vencimento')
    })
})
