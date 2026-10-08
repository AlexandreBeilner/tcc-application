import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminReauthProvider } from '../../features/admin/AdminReauth'
import { useAuth } from '../../features/auth/AuthContext'
import {
    deleteAdminUser,
    forceLogoutAdminUser,
    getAdminUser,
    getUserCorrectionContext,
    reactivateAdminUser,
    suspendAdminUser,
} from '../../services/admin'
import type { AdminUserDetail } from '../../services/admin'
import { ApiError, REAUTH_REQUIRED } from '../../services/client'
import { reauthenticate } from '../../services/auth'
import { AdminUsuarioDetalhe } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/auth', () => ({ reauthenticate: vi.fn() }))
vi.mock('../../services/admin', () => ({
    getAdminUser: vi.fn(),
    suspendAdminUser: vi.fn(),
    reactivateAdminUser: vi.fn(),
    forceLogoutAdminUser: vi.fn(),
    deleteAdminUser: vi.fn(),
    getUserCorrectionContext: vi.fn(),
    creditAdminUser: vi.fn(),
    adjustAdminUserXp: vi.fn(),
    setAdminUserStreak: vi.fn(),
    grantAdminUserAchievement: vi.fn(),
    correctAdminUserLesson: vi.fn(),
}))

const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff'

const detail: AdminUserDetail = {
    account: {
        id: ID,
        name: 'Maria Souza',
        email: 'maria@example.com',
        username: 'maria',
        role: 'user',
        status: 'active',
        onboarding_completed: true,
        providers: ['password'],
        created_at: '2026-10-01T12:00:00Z',
        suspended_reason: null,
        suspended_at: null,
    },
    progression: { xp: 100, level: 2, current_streak: 1, longest_streak: 2, last_qualifying_activity_date: null },
    achievements_count: 0,
    friends_count: 0,
    portfolio: null,
    open_orders: { total: 0, orders: [] },
    timeline: [],
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[`/admin/usuarios/${ID}`]}>
                <AdminReauthProvider>
                    <Routes>
                        <Route path="/admin/usuarios/:id" element={<AdminUsuarioDetalhe />} />
                        <Route path="/admin/usuarios" element={<div>lista de usuários</div>} />
                    </Routes>
                </AdminReauthProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAdminUser).mockResolvedValue(detail)
    vi.mocked(getUserCorrectionContext).mockResolvedValue({ achievements: [], lessons: [] })
})

describe('AdminUsuarioDetalhe', () => {
    it('mostra o detalhe e as três ações de uma conta ativa', async () => {
        renderPage()
        expect(await screen.findByRole('heading', { name: 'Maria Souza' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Suspender conta' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Encerrar sessões' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Excluir conta (LGPD)' })).toBeEnabled()
        expect(screen.queryByRole('button', { name: 'Reativar conta' })).not.toBeInTheDocument()
    })

    it('suspende com motivo obrigatório e avisa', async () => {
        vi.mocked(suspendAdminUser).mockResolvedValue(undefined)
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Suspender conta' }))
        const dialog = screen.getByRole('dialog', { name: 'Suspender esta conta?' })
        const confirm = within(dialog).getByRole('button', { name: 'Suspender conta' })
        expect(confirm).toBeDisabled()

        fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'spam no feed' } })
        fireEvent.click(confirm)

        await waitFor(() => expect(suspendAdminUser).toHaveBeenCalledWith('tok', ID, 'spam no feed'))
        expect(await screen.findByRole('status')).toHaveTextContent('Conta suspensa')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('com a senha vencida pede a senha, reautentica e repete a suspensão com o token novo', async () => {
        vi.mocked(suspendAdminUser).mockRejectedValueOnce(new ApiError(401, REAUTH_REQUIRED)).mockResolvedValueOnce(undefined)
        vi.mocked(reauthenticate).mockResolvedValue({ token: 'novo' })
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Suspender conta' }))
        fireEvent.change(within(screen.getByRole('dialog', { name: 'Suspender esta conta?' })).getByLabelText(/Motivo/), {
            target: { value: 'spam no feed' },
        })
        fireEvent.click(
            within(screen.getByRole('dialog', { name: 'Suspender esta conta?' })).getByRole('button', { name: 'Suspender conta' }),
        )

        const password = await screen.findByLabelText('Senha')
        fireEvent.change(password, { target: { value: 'senha-forte-123' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

        await waitFor(() => expect(suspendAdminUser).toHaveBeenLastCalledWith('novo', ID, 'spam no feed'))
        expect(reauthenticate).toHaveBeenCalledWith('tok', 'senha-forte-123')
    })

    it('mostra Reativar numa conta suspensa e reativa sem pedir confirmação de senha', async () => {
        vi.mocked(getAdminUser).mockResolvedValue({
            ...detail,
            account: { ...detail.account, status: 'suspended', suspended_reason: 'spam no feed', suspended_at: '2026-10-03T12:00:00Z' },
        })
        vi.mocked(reactivateAdminUser).mockResolvedValue(undefined)
        renderPage()
        expect(screen.queryByRole('button', { name: 'Suspender conta' })).not.toBeInTheDocument()
        fireEvent.click(await screen.findByRole('button', { name: 'Reativar conta' }))

        await waitFor(() => expect(reactivateAdminUser).toHaveBeenCalledWith('tok', ID))
        expect(await screen.findByRole('status')).toHaveTextContent('Conta reativada')
    })

    it('encerrar sessões confirma e chama o serviço', async () => {
        vi.mocked(forceLogoutAdminUser).mockResolvedValue(undefined)
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Encerrar sessões' }))
        const dialog = screen.getByRole('dialog', { name: 'Encerrar as sessões desta conta?' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Encerrar sessões' }))

        await waitFor(() => expect(forceLogoutAdminUser).toHaveBeenCalledWith('tok', ID))
        expect(await screen.findByRole('status')).toHaveTextContent('Sessões encerradas')
    })

    it('excluir exige digitar o username e volta pra lista', async () => {
        vi.mocked(deleteAdminUser).mockResolvedValue(undefined)
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Excluir conta (LGPD)' }))
        const dialog = screen.getByRole('dialog', { name: 'Excluir esta conta?' })
        const confirm = within(dialog).getByRole('button', { name: 'Excluir conta' })
        expect(confirm).toBeDisabled()

        fireEvent.change(within(dialog).getByLabelText(/Para confirmar, digite/), { target: { value: 'maria' } })
        fireEvent.click(confirm)

        await waitFor(() => expect(deleteAdminUser).toHaveBeenCalledWith('tok', ID, 'maria'))
        expect(await screen.findByText('lista de usuários')).toBeInTheDocument()
    })

    it('conta de administrador não pode ser suspensa nem excluída pelo painel', async () => {
        vi.mocked(getAdminUser).mockResolvedValue({ ...detail, account: { ...detail.account, role: 'admin' } })
        renderPage()
        await screen.findByRole('heading', { name: 'Maria Souza' })
        expect(screen.getByRole('button', { name: 'Suspender conta' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Excluir conta (LGPD)' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Encerrar sessões' })).toBeEnabled()
        expect(screen.getByText(/Conta de administrador não é suspensa/)).toBeInTheDocument()
    })

    it('mostra as correções de conta numa conta comum e esconde numa conta excluída', async () => {
        const { unmount } = renderPage()
        expect(await screen.findByRole('heading', { name: 'Correções de conta' })).toBeInTheDocument()
        unmount()

        vi.mocked(getAdminUser).mockResolvedValue({
            ...detail,
            account: { ...detail.account, username: 'usuario-removido-1a2b3c4d' },
        })
        renderPage()
        await screen.findByRole('heading', { name: 'Conta excluída' })
        expect(screen.queryByRole('heading', { name: 'Correções de conta' })).not.toBeInTheDocument()
    })

    it('usuário inexistente mostra o 404 com link de volta', async () => {
        vi.mocked(getAdminUser).mockRejectedValue(new ApiError(404, 'usuário não encontrado'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Usuário não encontrado.')
        expect(screen.getByRole('link', { name: 'Voltar para Usuários' })).toHaveAttribute('href', '/admin/usuarios')
    })

    it('recusa do backend (409) aparece dentro da janela de suspensão', async () => {
        vi.mocked(suspendAdminUser).mockRejectedValue(new ApiError(409, 'a conta já está suspensa'))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Suspender conta' }))
        fireEvent.change(within(screen.getByRole('dialog', { name: 'Suspender esta conta?' })).getByLabelText(/Motivo/), {
            target: { value: 'spam no feed' },
        })
        fireEvent.click(
            within(screen.getByRole('dialog', { name: 'Suspender esta conta?' })).getByRole('button', { name: 'Suspender conta' }),
        )

        expect(await screen.findByText('A conta já está suspensa.')).toBeInTheDocument()
        expect(screen.getByRole('dialog', { name: 'Suspender esta conta?' })).toBeInTheDocument()
    })
})
