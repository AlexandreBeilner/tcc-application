import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getAdminLessons, setLessonPublished } from '../../../services/admin'
import type { AdminLesson } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { AdminLessonsTable } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({
    getAdminLessons: vi.fn(),
    setLessonPublished: vi.fn(),
}))

const funnel = {
    started: 10,
    completed: 6,
    abandoned: 4,
    completion_rate: 0.6,
    avg_seconds_to_complete: 200,
    median_seconds_to_complete: 180,
    bet_answered: 6,
    bet_correct: 3,
    bet_accuracy: 0.5,
    abandoned_by_step: [0, 3, 1, 0],
}

const first: AdminLesson = {
    id: 'l1',
    code: '0.1',
    title: 'O que é investir',
    track_number: 0,
    track_name: 'Trilha 0: Fundamentos',
    sort_order: 1,
    micro_decision_type: 'reflection',
    has_bet: true,
    unlocks_keys: [],
    published: true,
    prerequisite_code: null,
    funnel,
}

const second: AdminLesson = {
    ...first,
    id: 'l2',
    code: '1.1',
    title: 'Tesouro Selic',
    track_number: 1,
    track_name: 'Trilha 1: Renda Fixa',
    sort_order: 2,
    micro_decision_type: 'live_indicator',
    has_bet: false,
    published: false,
    prerequisite_code: null,
    funnel: {
        ...funnel,
        started: 0,
        completed: 0,
        abandoned: 0,
        completion_rate: null,
        median_seconds_to_complete: null,
        bet_accuracy: null,
        abandoned_by_step: [0, 0, 0, 0],
    },
}

function renderTable() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminLessonsTable />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

async function tables() {
    return (await screen.findAllByRole('table', { hidden: true })).map((t) => within(t))
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAdminLessons).mockResolvedValue({ lessons: [first, second] })
})

describe('AdminLessonsTable', () => {
    it('agrupa por trilha e mostra o funil: iniciaram, concluíram, tempo típico, aposta e passo onde para', async () => {
        renderTable()

        expect(await screen.findByRole('heading', { name: 'Trilha 0: Fundamentos' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Trilha 1: Renda Fixa' })).toBeInTheDocument()
        const [t0] = await tables()
        expect(t0.getByText('0.1 · O que é investir')).toBeInTheDocument()
        expect(t0.getByText('Reflexão com aposta')).toBeInTheDocument()
        expect(t0.getByText('6 (60%)')).toBeInTheDocument()
        expect(t0.getByText('3 min')).toBeInTheDocument()
        expect(t0.getByText('50%')).toBeInTheDocument()
        expect(t0.getByText('Micro-decisão (3 de 4)')).toBeInTheDocument()
        expect(t0.getByText('Publicada')).toBeInTheDocument()
    })

    it('lição sem dados mostra "sem dados" e "sem aposta", e a despublicada aparece como tal', async () => {
        renderTable()

        const t1 = (await tables())[1]
        expect(t1.getByText('Indicador de ativo ao vivo')).toBeInTheDocument()
        expect(t1.getByText('sem dados')).toBeInTheDocument()
        expect(t1.getByText('sem aposta')).toBeInTheDocument()
        expect(t1.getByText('ninguém')).toBeInTheDocument()
        expect(t1.getByText('Despublicada')).toBeInTheDocument()
    })

    it('despublicar pede confirmação, explica o efeito e só então chama a API', async () => {
        vi.mocked(setLessonPublished).mockResolvedValue({ id: 'l1', code: '0.1', title: 'x', published: false, waived_users: 0 })
        renderTable()
        const [t0] = await tables()

        fireEvent.click(t0.getByRole('button', { name: 'Despublicar' }))
        expect(setLessonPublished).not.toHaveBeenCalled()
        expect(screen.getByText(/ninguém perde progresso/i)).toBeInTheDocument()

        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Despublicar' }))
        await waitFor(() => expect(setLessonPublished).toHaveBeenCalledWith('tok', 'l1', false))
        expect(await screen.findByText('Lição 0.1 despublicada. Ninguém perdeu progresso.')).toBeInTheDocument()
    })

    it('publicar de volta é direto e conta quantos usuários receberam a lição como opcional', async () => {
        vi.mocked(setLessonPublished).mockResolvedValue({ id: 'l2', code: '1.1', title: 'x', published: true, waived_users: 4 })
        renderTable()
        const t1 = (await tables())[1]

        fireEvent.click(t1.getByRole('button', { name: 'Publicar' }))

        await waitFor(() => expect(setLessonPublished).toHaveBeenCalledWith('tok', 'l2', true))
        expect(
            await screen.findByText(/4 usuário\(s\) que já tinham passado desse ponto receberam a lição como opcional/),
        ).toBeInTheDocument()
    })

    it('mostra a mensagem do backend quando a ação é recusada', async () => {
        vi.mocked(setLessonPublished).mockRejectedValue(new ApiError(409, 'a lição já está publicada'))
        renderTable()
        const t1 = (await tables())[1]

        fireEvent.click(t1.getByRole('button', { name: 'Publicar' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('a lição já está publicada')
    })

    it('cada lição tem link pra edição e há um atalho pra criar lição', async () => {
        renderTable()
        const [t0] = await tables()

        expect(t0.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/admin/conteudo/l1')
        expect(t0.getByRole('link', { name: 'Funil' })).toHaveAttribute('href', '/admin/conteudo/l1/funil')
        expect(screen.getByRole('link', { name: 'Nova lição' })).toHaveAttribute('href', '/admin/conteudo/nova')
    })

    it('avisa quando a lista não carrega', async () => {
        vi.mocked(getAdminLessons).mockRejectedValue(new Error('boom'))
        renderTable()

        expect(await screen.findByText('Não foi possível carregar as lições agora.')).toBeInTheDocument()
    })
})
