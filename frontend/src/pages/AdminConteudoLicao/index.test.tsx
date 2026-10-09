import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getAdminLesson, getAdminLessons, restoreLessonRevision, updateAdminLesson } from '../../services/admin'
import type { AdminLessonDetail } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminConteudoLicao } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    getAdminLesson: vi.fn(),
    getAdminLessons: vi.fn(),
    updateAdminLesson: vi.fn(),
    restoreLessonRevision: vi.fn(),
    getLessonRevision: vi.fn(),
}))

const lesson: AdminLessonDetail = {
    id: 'l1',
    code: '0.1',
    track_number: 0,
    track_name: 'Trilha 0: Fundamentos',
    sort_order: 1,
    published: true,
    title: 'O que é investir',
    central_concept: 'Conceito',
    scenario_text: 'Cenário',
    micro_decision_prompt: 'Pense',
    micro_decision_type: 'reflection',
    micro_decision_asset_ticker: null,
    micro_decision_options: null,
    micro_decision_correct_option: null,
    revelation_text: 'Revelação',
    unlocks_description: null,
    unlocks_keys: [],
    unlocks_asset_ticker: null,
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin/conteudo/l1']}>
                <Routes>
                    <Route path="/admin/conteudo/:id" element={<AdminConteudoLicao />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAdminLesson).mockResolvedValue({ lesson, revisions: [] })
    vi.mocked(getAdminLessons).mockResolvedValue({ lessons: [] })
})

describe('AdminConteudoLicao', () => {
    it('carrega a lição no formulário e começa com Salvar desabilitado', async () => {
        renderPage()

        expect(await screen.findByRole('heading', { name: '0.1 · O que é investir' })).toBeInTheDocument()
        expect(screen.getByLabelText('Título')).toHaveValue('O que é investir')
        expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    })

    it('editar habilita Salvar e envia o conteúdo inteiro, mostrando o aviso de copy devolvido', async () => {
        vi.mocked(updateAdminLesson).mockResolvedValue({
            lesson,
            warnings: ['o campo cenário usa travessão (—) como pontuação; o texto do produto evita'],
        })
        renderPage()
        await screen.findByLabelText('Título')

        fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Novo título' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

        await waitFor(() => expect(updateAdminLesson).toHaveBeenCalledTimes(1))
        expect(updateAdminLesson).toHaveBeenCalledWith(
            'tok',
            'l1',
            expect.objectContaining({ title: 'Novo título', scenario_text: 'Cenário', unlocks_keys: [] }),
        )
        expect(await screen.findByText('Lição salva. O conteúdo já vale para todos os usuários.')).toBeInTheDocument()
        expect(screen.getByText(/usa travessão/)).toBeInTheDocument()
    })

    it('mostra a mensagem de domínio quando o backend recusa o conteúdo', async () => {
        vi.mocked(updateAdminLesson).mockRejectedValue(new ApiError(422, 'a aposta tem de 2 a 6 opções'))
        renderPage()
        await screen.findByLabelText('Título')

        fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'x' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('a aposta tem de 2 a 6 opções')
    })

    it('restaurar uma revisão chama a API e avisa', async () => {
        vi.mocked(getAdminLesson).mockResolvedValue({
            lesson,
            revisions: [{ id: 'r1', action: 'baseline', admin_id: null, admin_username: null, created_at: '2026-09-01T12:00:00.000Z' }],
        })
        vi.mocked(restoreLessonRevision).mockResolvedValue({ lesson, warnings: [] })
        renderPage()
        await screen.findByLabelText('Título')

        fireEvent.click(await screen.findByRole('button', { name: 'Restaurar' }))
        fireEvent.click(screen.getAllByRole('button', { name: 'Restaurar' }).at(-1) as HTMLElement)

        await waitFor(() => expect(restoreLessonRevision).toHaveBeenCalledWith('tok', 'l1', 'r1'))
        expect(await screen.findByText('Revisão restaurada.')).toBeInTheDocument()
    })

    it('avisa quando a lição não carrega', async () => {
        vi.mocked(getAdminLesson).mockRejectedValue(new ApiError(404, 'lição não encontrada'))
        renderPage()

        expect(await screen.findByText('Não foi possível carregar esta lição. Ela pode não existir.')).toBeInTheDocument()
    })
})
