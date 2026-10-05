import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { createAdminLesson, getAdminLessons } from '../../services/admin'
import type { AdminLesson, AdminLessonDetail } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminConteudoNova } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ getAdminLessons: vi.fn(), createAdminLesson: vi.fn() }))

const funnel = {
    started: 0,
    completed: 0,
    abandoned: 0,
    completion_rate: null,
    avg_seconds_to_complete: null,
    median_seconds_to_complete: null,
    bet_answered: 0,
    bet_correct: 0,
    bet_accuracy: null,
    abandoned_by_step: [0, 0, 0, 0],
}

const existing: AdminLesson = {
    id: 'l1',
    code: '0.1',
    title: 'O que é investir',
    track_number: 0,
    track_name: 'Trilha 0: Fundamentos',
    sort_order: 1,
    micro_decision_type: 'reflection',
    has_bet: false,
    unlocks_keys: [],
    published: true,
    prerequisite_code: null,
    funnel,
}

const created = { id: 'new1', code: '0.6', title: 'Nova' } as AdminLessonDetail

function Landing() {
    const location = useLocation()
    return (
        <p>
            Editor de {location.pathname} com aviso: {(location.state as { notice?: string } | null)?.notice}
        </p>
    )
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin/conteudo/nova']}>
                <Routes>
                    <Route path="/admin/conteudo/nova" element={<AdminConteudoNova />} />
                    <Route path="/admin/conteudo/:id" element={<Landing />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAdminLessons).mockResolvedValue({ lessons: [existing] })
})

async function fillMinimum() {
    await screen.findByRole('option', { name: '0.1 · O que é investir' })
    fireEvent.change(screen.getByLabelText('Entra depois de'), { target: { value: 'l1' } })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nova lição' } })
    fireEvent.change(screen.getByLabelText('Conceito central'), { target: { value: 'Conceito' } })
}

describe('AdminConteudoNova', () => {
    it('Criar fica desabilitado até escolher a posição e preencher título e conceito', async () => {
        renderPage()
        await screen.findByRole('option', { name: '0.1 · O que é investir' })

        expect(screen.getByRole('button', { name: 'Criar lição' })).toBeDisabled()
        await fillMinimum()
        expect(screen.getByRole('button', { name: 'Criar lição' })).toBeEnabled()
        expect(screen.getByText('Fica na Trilha 0: Fundamentos, logo depois da lição 0.1.')).toBeInTheDocument()
    })

    it('cria com a posição escolhida, leva pro editor e conta quem recebeu a lição como opcional', async () => {
        vi.mocked(createAdminLesson).mockResolvedValue({ lesson: created, warnings: [], waived_users: 3 })
        renderPage()
        await fillMinimum()

        fireEvent.click(screen.getByRole('button', { name: 'Criar lição' }))

        await waitFor(() => expect(createAdminLesson).toHaveBeenCalledTimes(1))
        expect(createAdminLesson).toHaveBeenCalledWith(
            'tok',
            expect.objectContaining({ title: 'Nova lição', central_concept: 'Conceito', after_lesson_id: 'l1' }),
        )
        expect(await screen.findByText(/Editor de \/admin\/conteudo\/new1/)).toHaveTextContent(
            'Lição 0.6 criada. 3 usuário(s) que já tinham passado desse ponto receberam a lição como opcional.',
        )
    })

    it('"No início do currículo" manda after_lesson_id nulo', async () => {
        vi.mocked(createAdminLesson).mockResolvedValue({ lesson: created, warnings: [], waived_users: 0 })
        renderPage()
        await fillMinimum()
        fireEvent.change(screen.getByLabelText('Entra depois de'), { target: { value: '__start__' } })

        fireEvent.click(screen.getByRole('button', { name: 'Criar lição' }))

        await waitFor(() => expect(createAdminLesson).toHaveBeenCalledWith('tok', expect.objectContaining({ after_lesson_id: null })))
    })

    it('mostra a mensagem do backend quando o conteúdo é recusado e não sai da tela', async () => {
        vi.mocked(createAdminLesson).mockRejectedValue(new ApiError(422, 'o ticker NADA3 não existe no catálogo'))
        renderPage()
        await fillMinimum()

        fireEvent.click(screen.getByRole('button', { name: 'Criar lição' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('o ticker NADA3 não existe no catálogo')
        expect(screen.getByRole('button', { name: 'Criar lição' })).toBeEnabled()
    })
})
