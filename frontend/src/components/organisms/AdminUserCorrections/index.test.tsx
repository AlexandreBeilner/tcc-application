import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminReauthProvider } from '../../../features/admin/AdminReauth'
import { useAuth } from '../../../features/auth/AuthContext'
import {
    adjustAdminUserXp,
    correctAdminUserAchievement,
    correctAdminUserLesson,
    creditAdminUser,
    getUserCorrectionContext,
    setAdminUserStreak,
} from '../../../services/admin'
import { ApiError, REAUTH_REQUIRED } from '../../../services/client'
import { reauthenticate } from '../../../services/auth'
import { AdminUserCorrections } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/auth', () => ({ reauthenticate: vi.fn() }))
vi.mock('../../../services/admin', () => ({
    getUserCorrectionContext: vi.fn(),
    creditAdminUser: vi.fn(),
    adjustAdminUserXp: vi.fn(),
    setAdminUserStreak: vi.fn(),
    correctAdminUserAchievement: vi.fn(),
    correctAdminUserLesson: vi.fn(),
}))

const USER_ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff'

const context = {
    achievements: [
        { id: 'a1', name: 'Primeira Semana', description: null, unlocked: false },
        { id: 'a2', name: 'Fiel', description: null, unlocked: true },
    ],
    lessons: [
        { id: 'l1', code: '0.1', title: 'Boas-vindas', track_number: 0, status: 'not_started' as const },
        { id: 'l2', code: '0.2', title: 'Juros', track_number: 0, status: 'completed' as const },
    ],
}

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminReauthProvider>
                    <AdminUserCorrections userId={USER_ID} username="maria" />
                </AdminReauthProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

function card(name: string) {
    return within(screen.getByRole(name === 'Conquistas' || name === 'Lições' ? 'group' : 'form', { name }))
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getUserCorrectionContext).mockResolvedValue(context)
})

describe('AdminUserCorrections', () => {
    describe('crédito de caixa', () => {
        it('só habilita com valor positivo e pede confirmação mostrando o valor formatado', async () => {
            vi.mocked(creditAdminUser).mockResolvedValue({ user_id: USER_ID, credited: 1500.5 })
            renderPanel()
            const form = card('Crédito de caixa')
            const submit = form.getByRole('button', { name: 'Creditar' })
            expect(submit).toBeDisabled()

            fireEvent.change(form.getByLabelText('Valor (R$)'), { target: { value: '1.500,50' } })
            fireEvent.change(form.getByLabelText(/Motivo/), { target: { value: 'reparo do bug' } })
            fireEvent.click(submit)

            const dialog = screen.getByRole('dialog', { name: 'Creditar caixa nesta conta?' })
            expect(dialog).toHaveTextContent(/R\$\s?1\.500,50/)
            expect(creditAdminUser).not.toHaveBeenCalled()

            fireEvent.click(within(dialog).getByRole('button', { name: 'Creditar' }))

            await waitFor(() => expect(creditAdminUser).toHaveBeenCalledWith('tok', USER_ID, { amount: 1500.5, reason: 'reparo do bug' }))
            expect(await screen.findByRole('status')).toHaveTextContent(/Crédito de R\$\s?1\.500,50 aplicado em @maria/)
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        it.each(['0', '-5', 'abc', '', '1,2,3'])('valor "%s" não habilita o botão', (value) => {
            renderPanel()
            const form = card('Crédito de caixa')
            fireEvent.change(form.getByLabelText('Valor (R$)'), { target: { value } })
            expect(form.getByRole('button', { name: 'Creditar' })).toBeDisabled()
        })

        it('cancelar a confirmação não credita nada', () => {
            renderPanel()
            const form = card('Crédito de caixa')
            fireEvent.change(form.getByLabelText('Valor (R$)'), { target: { value: '99999999' } })
            fireEvent.click(form.getByRole('button', { name: 'Creditar' }))
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
            expect(creditAdminUser).not.toHaveBeenCalled()
        })

        it('o motivo é opcional: sem ele o corpo vai só com o valor', async () => {
            vi.mocked(creditAdminUser).mockResolvedValue({ user_id: USER_ID, credited: 10 })
            renderPanel()
            const form = card('Crédito de caixa')
            fireEvent.change(form.getByLabelText('Valor (R$)'), { target: { value: '10' } })
            fireEvent.click(form.getByRole('button', { name: 'Creditar' }))
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Creditar' }))

            await waitFor(() => expect(creditAdminUser).toHaveBeenCalledWith('tok', USER_ID, { amount: 10 }))
        })

        it('recusa do motor aparece dentro da janela de confirmação', async () => {
            vi.mocked(creditAdminUser).mockRejectedValue(
                new ApiError(422, 'o crédito faria o saldo passar do limite suportado', { code: 'balance_overflow' }),
            )
            renderPanel()
            const form = card('Crédito de caixa')
            fireEvent.change(form.getByLabelText('Valor (R$)'), { target: { value: '9000000000000' } })
            fireEvent.click(form.getByRole('button', { name: 'Creditar' }))
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Creditar' }))

            expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('passar do limite suportado')
        })

        it('com a senha vencida pede a senha e repete o crédito com o token novo', async () => {
            vi.mocked(creditAdminUser)
                .mockRejectedValueOnce(new ApiError(401, REAUTH_REQUIRED))
                .mockResolvedValueOnce({ user_id: USER_ID, credited: 10 })
            vi.mocked(reauthenticate).mockResolvedValue({ token: 'novo' })
            renderPanel()
            const form = card('Crédito de caixa')
            fireEvent.change(form.getByLabelText('Valor (R$)'), { target: { value: '10' } })
            fireEvent.click(form.getByRole('button', { name: 'Creditar' }))
            fireEvent.click(
                within(screen.getByRole('dialog', { name: 'Creditar caixa nesta conta?' })).getByRole('button', { name: 'Creditar' }),
            )

            fireEvent.change(await screen.findByLabelText('Senha'), { target: { value: 'senha-forte-123' } })
            fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

            await waitFor(() => expect(creditAdminUser).toHaveBeenLastCalledWith('novo', USER_ID, { amount: 10 }))
        })
    })

    describe('XP e streak', () => {
        it('ajusta XP com motivo e mostra o resultado', async () => {
            vi.mocked(adjustAdminUserXp).mockResolvedValue({ xp: 250, level: 2, current_streak: 0, longest_streak: 0 })
            renderPanel()
            const form = card('Ajuste de XP')
            const submit = form.getByRole('button', { name: 'Aplicar ajuste' })
            expect(submit).toBeDisabled()

            fireEvent.change(form.getByLabelText('Variação de XP'), { target: { value: '-50' } })
            expect(submit).toBeDisabled()
            fireEvent.change(form.getByLabelText('Motivo'), { target: { value: 'XP por engano' } })
            fireEvent.click(submit)

            await waitFor(() => expect(adjustAdminUserXp).toHaveBeenCalledWith('tok', USER_ID, -50, 'XP por engano'))
            expect(await screen.findByRole('status')).toHaveTextContent('Agora são 250 XP, nível 2')
        })

        it.each(['0', '1.5', 'dez', ''])('variação "%s" não habilita o ajuste', (value) => {
            renderPanel()
            const form = card('Ajuste de XP')
            fireEvent.change(form.getByLabelText('Variação de XP'), { target: { value } })
            fireEvent.change(form.getByLabelText('Motivo'), { target: { value: 'motivo válido' } })
            expect(form.getByRole('button', { name: 'Aplicar ajuste' })).toBeDisabled()
        })

        it('define o streak, aceitando zero', async () => {
            vi.mocked(setAdminUserStreak).mockResolvedValue({ xp: 0, level: 1, current_streak: 0, longest_streak: 9 })
            renderPanel()
            const form = card('Ajuste de streak')
            fireEvent.change(form.getByLabelText('Streak atual (dias)'), { target: { value: '0' } })
            fireEvent.change(form.getByLabelText('Motivo'), { target: { value: 'reiniciar streak' } })
            fireEvent.click(form.getByRole('button', { name: 'Definir streak' }))

            await waitFor(() => expect(setAdminUserStreak).toHaveBeenCalledWith('tok', USER_ID, 0, 'reiniciar streak'))
            expect(await screen.findByRole('status')).toHaveTextContent('Streak definido em 0 dia(s). Maior streak: 9.')
        })

        it('motivo curto demais não habilita', () => {
            renderPanel()
            const form = card('Ajuste de streak')
            fireEvent.change(form.getByLabelText('Streak atual (dias)'), { target: { value: '5' } })
            fireEvent.change(form.getByLabelText('Motivo'), { target: { value: 'ok' } })
            expect(form.getByRole('button', { name: 'Definir streak' })).toBeDisabled()
        })

        it('recusa de regra (422) aparece como alerta', async () => {
            vi.mocked(adjustAdminUserXp).mockRejectedValue(
                new ApiError(422, 'o usuário tem 100 XP, não dá pra tirar 500', { code: 'invalid_correction' }),
            )
            renderPanel()
            const form = card('Ajuste de XP')
            fireEvent.change(form.getByLabelText('Variação de XP'), { target: { value: '-500' } })
            fireEvent.change(form.getByLabelText('Motivo'), { target: { value: 'tirar tudo' } })
            fireEvent.click(form.getByRole('button', { name: 'Aplicar ajuste' }))

            expect(await screen.findByRole('alert')).toHaveTextContent('não dá pra tirar 500')
        })
    })

    describe('conquistas', () => {
        it('concede uma conquista que o usuário não tem e bloqueia revogar', async () => {
            vi.mocked(correctAdminUserAchievement).mockResolvedValue(undefined)
            renderPanel()
            const group = card('Conquistas')
            await screen.findByRole('option', { name: 'Fiel (já tem)' })

            fireEvent.change(group.getByLabelText('Conquista'), { target: { value: 'a1' } })
            fireEvent.change(group.getByLabelText('Motivo'), { target: { value: 'bug do streak' } })
            expect(group.getByRole('button', { name: 'Revogar' })).toBeDisabled()
            fireEvent.click(group.getByRole('button', { name: 'Conceder' }))

            await waitFor(() => expect(correctAdminUserAchievement).toHaveBeenCalledWith('tok', USER_ID, 'a1', 'grant', 'bug do streak'))
            expect(await screen.findByRole('status')).toHaveTextContent('Conquista "Primeira Semana" concedida.')
        })

        it('revoga uma conquista que o usuário já tem e bloqueia conceder', async () => {
            vi.mocked(correctAdminUserAchievement).mockResolvedValue(undefined)
            renderPanel()
            const group = card('Conquistas')
            await screen.findByRole('option', { name: 'Fiel (já tem)' })

            fireEvent.change(group.getByLabelText('Conquista'), { target: { value: 'a2' } })
            fireEvent.change(group.getByLabelText('Motivo'), { target: { value: 'dada por engano' } })
            expect(group.getByRole('button', { name: 'Conceder' })).toBeDisabled()
            fireEvent.click(group.getByRole('button', { name: 'Revogar' }))

            await waitFor(() => expect(correctAdminUserAchievement).toHaveBeenCalledWith('tok', USER_ID, 'a2', 'revoke', 'dada por engano'))
        })

        it('sem conquista escolhida ou sem motivo, nada habilita', async () => {
            renderPanel()
            const group = card('Conquistas')
            await screen.findByRole('option', { name: 'Fiel (já tem)' })
            fireEvent.change(group.getByLabelText('Motivo'), { target: { value: 'motivo válido' } })
            expect(group.getByRole('button', { name: 'Conceder' })).toBeDisabled()
            expect(group.getByRole('button', { name: 'Revogar' })).toBeDisabled()
        })
    })

    describe('lições', () => {
        it('conclui uma lição não concluída, avisando que não dá XP', async () => {
            vi.mocked(correctAdminUserLesson).mockResolvedValue(undefined)
            renderPanel()
            const group = card('Lições')
            await screen.findByRole('option', { name: '0.2 · Juros (concluída)' })

            fireEvent.change(group.getByLabelText('Lição'), { target: { value: 'l1' } })
            fireEvent.change(group.getByLabelText('Motivo'), { target: { value: 'lição travada' } })
            expect(group.getByRole('button', { name: 'Reabrir' })).toBeDisabled()
            fireEvent.click(group.getByRole('button', { name: 'Marcar como concluída' }))

            await waitFor(() => expect(correctAdminUserLesson).toHaveBeenCalledWith('tok', USER_ID, 'l1', 'complete', 'lição travada'))
            expect(await screen.findByRole('status')).toHaveTextContent('Lição 0.1 marcada como concluída (sem XP).')
        })

        it('reabre uma lição concluída e bloqueia concluir de novo', async () => {
            vi.mocked(correctAdminUserLesson).mockResolvedValue(undefined)
            renderPanel()
            const group = card('Lições')
            await screen.findByRole('option', { name: '0.2 · Juros (concluída)' })

            fireEvent.change(group.getByLabelText('Lição'), { target: { value: 'l2' } })
            fireEvent.change(group.getByLabelText('Motivo'), { target: { value: 'refazer a lição' } })
            expect(group.getByRole('button', { name: 'Marcar como concluída' })).toBeDisabled()
            fireEvent.click(group.getByRole('button', { name: 'Reabrir' }))

            await waitFor(() => expect(correctAdminUserLesson).toHaveBeenCalledWith('tok', USER_ID, 'l2', 'reopen', 'refazer a lição'))
            expect(await screen.findByRole('status')).toHaveTextContent('Lição 0.2 reaberta.')
        })
    })

    it('avisa quando os seletores não carregam, sem esconder os outros formulários', async () => {
        vi.mocked(getUserCorrectionContext).mockRejectedValue(new ApiError(500, 'falha'))
        renderPanel()

        expect(await screen.findByText('Não foi possível carregar as conquistas e lições deste usuário.')).toBeInTheDocument()
        expect(card('Crédito de caixa').getByRole('button', { name: 'Creditar' })).toBeInTheDocument()
    })
})
