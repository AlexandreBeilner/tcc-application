import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getMissionCatalog, updateMission } from '../../../services/admin'
import type { CatalogMission } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { AdminMissionsPanel } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({
    getMissionCatalog: vi.fn(),
    updateMission: vi.fn(),
}))

const feedRead: CatalogMission = {
    id: 'm1',
    key: 'feed_read',
    title: 'Consulte o feed de notícias',
    description: 'Leia pelo menos um evento.',
    completion_criteria: 'Reportado pelo cliente',
    xp_reward: 30,
    is_active: true,
    verification: 'client_reported',
    completed_users: 8,
    completed_today: 2,
}

const review: CatalogMission = {
    ...feedRead,
    id: 'm2',
    key: 'review_old_lesson',
    title: 'Revise uma lição antiga',
    description: null,
    is_active: false,
    verification: 'server_check',
    completed_users: 0,
    completed_today: 0,
}

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <AdminMissionsPanel />
        </QueryClientProvider>,
    )
}

async function table() {
    return within(await screen.findByRole('table', { hidden: true }))
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getMissionCatalog).mockResolvedValue({ missions: [feedRead, review] })
})

describe('AdminMissionsPanel', () => {
    it('lista missões com o tipo de conferência, XP, quantos concluíram (total e hoje) e o status', async () => {
        renderPanel()

        const t = await table()
        expect(await t.findByText('Consulte o feed de notícias')).toBeInTheDocument()
        expect(t.getByText('Reportada pelo app')).toBeInTheDocument()
        expect(t.getByText('Conferida pelo servidor')).toBeInTheDocument()
        expect(t.getByText('8 no total, 2 hoje')).toBeInTheDocument()
        expect(t.getByText('Ativa')).toBeInTheDocument()
        expect(t.getByText('Desativada')).toBeInTheDocument()
    })

    it('não existe criar missão: o tipo de conferência é código', async () => {
        renderPanel()
        await table()

        expect(screen.queryByRole('button', { name: /Nova missão/ })).not.toBeInTheDocument()
    })

    it('edita título, descrição e XP, e avisa que o tipo não muda', async () => {
        vi.mocked(updateMission).mockResolvedValue({ ...feedRead, xp_reward: 45 })
        renderPanel()
        const row = (await (await table()).findByText('Consulte o feed de notícias')).closest('tr') as HTMLElement
        fireEvent.click(within(row).getByRole('button', { name: 'Editar' }))

        const dialog = screen.getByRole('dialog', { name: 'Editar missão' })
        expect(dialog).toHaveTextContent('Conferência: Reportada pelo app')
        expect(within(dialog).getByLabelText('Título')).toHaveValue('Consulte o feed de notícias')
        fireEvent.change(within(dialog).getByLabelText(/^XP/), { target: { value: '45' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

        await waitFor(() =>
            expect(updateMission).toHaveBeenCalledWith('tok', 'm1', {
                title: 'Consulte o feed de notícias',
                description: 'Leia pelo menos um evento.',
                xp_reward: 45,
            }),
        )
        expect(await screen.findByRole('status')).toHaveTextContent('Missão "Consulte o feed de notícias" atualizada.')
    })

    it.each(['0', '501', '1,5', '', 'muito'])('XP "%s" não habilita o salvar', async (value) => {
        renderPanel()
        const row = (await (await table()).findByText('Consulte o feed de notícias')).closest('tr') as HTMLElement
        fireEvent.click(within(row).getByRole('button', { name: 'Editar' }))
        const dialog = screen.getByRole('dialog', { name: 'Editar missão' })

        fireEvent.change(within(dialog).getByLabelText(/^XP/), { target: { value } })

        expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeDisabled()
    })

    it('desativar pede confirmação e explica que o XP já dado continua', async () => {
        vi.mocked(updateMission).mockResolvedValue({ ...feedRead, is_active: false })
        renderPanel()
        const row = (await (await table()).findByText('Consulte o feed de notícias')).closest('tr') as HTMLElement
        fireEvent.click(within(row).getByRole('button', { name: 'Desativar' }))

        const dialog = screen.getByRole('dialog', { name: 'Desativar esta missão?' })
        expect(dialog).toHaveTextContent('Quem já concluiu mantém o XP e o streak')
        expect(updateMission).not.toHaveBeenCalled()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }))

        await waitFor(() => expect(updateMission).toHaveBeenCalledWith('tok', 'm1', { is_active: false }))
        expect(await screen.findByRole('status')).toHaveTextContent('desativada')
    })

    it('reativar não pede confirmação', async () => {
        vi.mocked(updateMission).mockResolvedValue({ ...review, is_active: true })
        renderPanel()
        const row = (await (await table()).findByText('Revise uma lição antiga')).closest('tr') as HTMLElement
        fireEvent.click(within(row).getByRole('button', { name: 'Reativar' }))

        await waitFor(() => expect(updateMission).toHaveBeenCalledWith('tok', 'm2', { is_active: true }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('mostra a recusa do backend (422) dentro do formulário', async () => {
        vi.mocked(updateMission).mockRejectedValue(new ApiError(422, 'o XP precisa ser um inteiro de 1 a 500'))
        renderPanel()
        const row = (await (await table()).findByText('Consulte o feed de notícias')).closest('tr') as HTMLElement
        fireEvent.click(within(row).getByRole('button', { name: 'Editar' }))
        const dialog = screen.getByRole('dialog', { name: 'Editar missão' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('o XP precisa ser um inteiro de 1 a 500')
    })

    it('avisa quando o catálogo não carrega', async () => {
        vi.mocked(getMissionCatalog).mockRejectedValue(new ApiError(500, 'falha'))
        renderPanel()

        expect(await screen.findByText('Não foi possível carregar as missões agora.')).toBeInTheDocument()
    })
})
