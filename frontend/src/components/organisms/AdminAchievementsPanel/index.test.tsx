import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { createAchievement, getAchievementCatalog, updateAchievement } from '../../../services/admin'
import type { AchievementCatalog } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { AdminAchievementsPanel } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({
    getAchievementCatalog: vi.fn(),
    createAchievement: vi.fn(),
    updateAchievement: vi.fn(),
}))

const catalog: AchievementCatalog = {
    achievements: [
        {
            id: 'a1',
            name: 'Primeira Semana',
            description: 'Sete dias seguidos.',
            criteria_type: 'streak_days',
            criteria_value: 7,
            is_active: true,
            is_rare: false,
            unlocked_count: 12,
        },
        {
            id: 'a2',
            name: 'Primeiro Patrimônio',
            description: null,
            criteria_type: 'net_worth',
            criteria_value: 12000,
            is_active: false,
            is_rare: true,
            unlocked_count: 3,
        },
    ],
    criteria: [
        { type: 'net_worth', label: 'Patrimônio (R$)', value_kind: 'currency' },
        { type: 'streak_days', label: 'Dias seguidos de streak', value_kind: 'integer' },
        { type: 'lessons_completed', label: 'Lições concluídas', value_kind: 'integer' },
    ],
}

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <AdminAchievementsPanel />
        </QueryClientProvider>,
    )
}

// A tabela (tablet em diante) e os cartões (mobile) ficam ambos no DOM; os testes miram a tabela.
async function table() {
    return within(await screen.findByRole('table', { hidden: true }))
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAchievementCatalog).mockResolvedValue(catalog)
})

describe('AdminAchievementsPanel', () => {
    it('lista conquistas com a regra, a meta, quantos ganharam e o status (ativa ou desativada)', async () => {
        renderPanel()

        const t = await table()
        expect(await t.findByText('Primeira Semana')).toBeInTheDocument()
        expect(t.getByText('Dias seguidos de streak: 7')).toBeInTheDocument()
        expect(t.getByText('12')).toBeInTheDocument()
        expect(t.getByText('Ativa')).toBeInTheDocument()
        expect(t.getByText('Desativada')).toBeInTheDocument()
        expect(t.getByText(/Patrimônio \(R\$\): R\$\s?12\.000,00/)).toBeInTheDocument()
    })

    it('cria uma conquista: meta em reais com vírgula, regra da lista fechada', async () => {
        vi.mocked(createAchievement).mockResolvedValue({ ...catalog.achievements[0], id: 'a3', name: 'Nova' })
        renderPanel()
        await screen.findByText('Primeira Semana', { selector: 'td div' })

        fireEvent.click(screen.getByRole('button', { name: 'Nova conquista' }))
        const dialog = screen.getByRole('dialog', { name: 'Nova conquista' })
        const submit = within(dialog).getByRole('button', { name: 'Criar conquista' })
        expect(submit).toBeDisabled()

        fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Grande Investidor' } })
        fireEvent.change(within(dialog).getByLabelText('Regra de desbloqueio'), { target: { value: 'net_worth' } })
        expect(within(dialog).getByLabelText('Meta (R$)')).toBeInTheDocument()
        fireEvent.change(within(dialog).getByLabelText('Meta (R$)'), { target: { value: '25.000,50' } })
        fireEvent.click(submit)

        await waitFor(() =>
            expect(createAchievement).toHaveBeenCalledWith('tok', {
                name: 'Grande Investidor',
                description: null,
                criteria_type: 'net_worth',
                criteria_value: 25000.5,
            }),
        )
        expect(await screen.findByRole('status')).toHaveTextContent('Conquista "Grande Investidor" criada.')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('meta de contagem só aceita inteiro positivo', async () => {
        renderPanel()
        await screen.findByText('Primeira Semana', { selector: 'td div' })
        fireEvent.click(screen.getByRole('button', { name: 'Nova conquista' }))
        const dialog = screen.getByRole('dialog', { name: 'Nova conquista' })
        fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'X' } })
        fireEvent.change(within(dialog).getByLabelText('Regra de desbloqueio'), { target: { value: 'lessons_completed' } })

        for (const value of ['', '0', '7,5', '-3', 'dez']) {
            fireEvent.change(within(dialog).getByLabelText('Meta (quantidade)'), { target: { value } })
            expect(within(dialog).getByRole('button', { name: 'Criar conquista' })).toBeDisabled()
        }
        fireEvent.change(within(dialog).getByLabelText('Meta (quantidade)'), { target: { value: '10' } })
        expect(within(dialog).getByRole('button', { name: 'Criar conquista' })).toBeEnabled()
    })

    it('edita uma conquista já preenchida e manda o formulário completo', async () => {
        vi.mocked(updateAchievement).mockResolvedValue(catalog.achievements[0])
        renderPanel()
        const row = (await (await table()).findByText('Primeira Semana')).closest('tr') as HTMLElement
        fireEvent.click(within(row).getByRole('button', { name: 'Editar' }))

        const dialog = screen.getByRole('dialog', { name: 'Editar conquista' })
        expect(within(dialog).getByLabelText('Nome')).toHaveValue('Primeira Semana')
        expect(within(dialog).getByLabelText('Meta (quantidade)')).toHaveValue('7')
        fireEvent.change(within(dialog).getByLabelText('Meta (quantidade)'), { target: { value: '10' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

        await waitFor(() =>
            expect(updateAchievement).toHaveBeenCalledWith('tok', 'a1', {
                name: 'Primeira Semana',
                description: 'Sete dias seguidos.',
                criteria_type: 'streak_days',
                criteria_value: 10,
            }),
        )
    })

    it('desativar pede confirmação explicando que ninguém perde a conquista', async () => {
        vi.mocked(updateAchievement).mockResolvedValue({ ...catalog.achievements[0], is_active: false })
        renderPanel()
        const row = (await (await table()).findByText('Primeira Semana')).closest('tr') as HTMLElement
        fireEvent.click(within(row).getByRole('button', { name: 'Desativar' }))

        const dialog = screen.getByRole('dialog', { name: 'Desativar esta conquista?' })
        expect(dialog).toHaveTextContent('12 usuário(s) que já a ganharam continuam com ela')
        expect(updateAchievement).not.toHaveBeenCalled()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }))

        await waitFor(() => expect(updateAchievement).toHaveBeenCalledWith('tok', 'a1', { is_active: false }))
        expect(await screen.findByRole('status')).toHaveTextContent('Conquista "Primeira Semana" desativada.')
    })

    it('marca e desmarca a conquista como rara, sem confirmação, e mostra a etiqueta', async () => {
        vi.mocked(updateAchievement).mockResolvedValue({ ...catalog.achievements[0], is_rare: true })
        renderPanel()
        const first = (await (await table()).findByText('Primeira Semana')).closest('tr') as HTMLElement
        expect(within(first).queryByText('Rara')).not.toBeInTheDocument()
        fireEvent.click(within(first).getByRole('button', { name: 'Marcar como rara' }))

        await waitFor(() => expect(updateAchievement).toHaveBeenCalledWith('tok', 'a1', { is_rare: true }))
        expect(await screen.findByRole('status')).toHaveTextContent('Conquista "Primeira Semana" marcada como rara.')

        const second = (await (await table()).findByText('Primeiro Patrimônio')).closest('tr') as HTMLElement
        expect(within(second).getByText('Rara')).toBeInTheDocument()
        expect(within(second).getByRole('button', { name: 'Tirar marca de rara' })).toBeInTheDocument()
    })

    it('reativar não pede confirmação', async () => {
        vi.mocked(updateAchievement).mockResolvedValue({ ...catalog.achievements[1], is_active: true })
        renderPanel()
        const row = (await (await table()).findByText('Primeiro Patrimônio')).closest('tr') as HTMLElement
        fireEvent.click(within(row).getByRole('button', { name: 'Reativar' }))

        await waitFor(() => expect(updateAchievement).toHaveBeenCalledWith('tok', 'a2', { is_active: true }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('mostra a recusa do backend dentro do formulário (nome repetido, 409)', async () => {
        vi.mocked(createAchievement).mockRejectedValue(new ApiError(409, 'já existe uma conquista com esse nome'))
        renderPanel()
        await screen.findByText('Primeira Semana', { selector: 'td div' })
        fireEvent.click(screen.getByRole('button', { name: 'Nova conquista' }))
        const dialog = screen.getByRole('dialog', { name: 'Nova conquista' })
        fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Primeira Semana' } })
        fireEvent.change(within(dialog).getByLabelText('Regra de desbloqueio'), { target: { value: 'streak_days' } })
        fireEvent.change(within(dialog).getByLabelText('Meta (quantidade)'), { target: { value: '7' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Criar conquista' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('já existe uma conquista com esse nome')
        expect(screen.getByRole('dialog', { name: 'Nova conquista' })).toBeInTheDocument()
    })

    it('avisa quando o catálogo não carrega e desabilita a criação', async () => {
        vi.mocked(getAchievementCatalog).mockRejectedValue(new ApiError(500, 'falha'))
        renderPanel()

        expect(await screen.findByText('Não foi possível carregar as conquistas agora.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Nova conquista' })).toBeDisabled()
    })
})
