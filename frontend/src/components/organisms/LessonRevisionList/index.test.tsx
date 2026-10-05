import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getLessonRevision } from '../../../services/admin'
import type { AdminLessonContent, LessonRevisionItem } from '../../../services/admin'
import { LessonRevisionList } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({ getLessonRevision: vi.fn() }))

const current: AdminLessonContent = {
    title: 'Título novo',
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

const revisions: LessonRevisionItem[] = [
    { id: 'r2', action: 'update', admin_id: 'a1', admin_username: 'admin', created_at: '2026-10-05T15:00:00.000Z' },
    { id: 'r1', action: 'baseline', admin_id: null, admin_username: null, created_at: '2026-09-01T12:00:00.000Z' },
]

function renderList(props: Partial<Parameters<typeof LessonRevisionList>[0]> = {}) {
    const onRestore = vi.fn()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <LessonRevisionList lessonId="l1" revisions={revisions} current={current} restoring={false} onRestore={onRestore} {...props} />
        </QueryClientProvider>,
    )
    return { onRestore }
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
})

describe('LessonRevisionList', () => {
    it('sem revisões explica que a primeira edição guarda o original', () => {
        renderList({ revisions: [] })

        expect(screen.getByText(/A primeira edição guarda a versão original/)).toBeInTheDocument()
    })

    it('lista as revisões com tipo, data e quem editou', () => {
        renderList()

        expect(screen.getByText('Edição')).toBeInTheDocument()
        expect(screen.getByText(/por admin/)).toBeInTheDocument()
        expect(screen.getByText('Versão original (antes da primeira edição)')).toBeInTheDocument()
    })

    it('comparar mostra só os campos que a restauração mudaria, com o valor da revisão e o atual', async () => {
        vi.mocked(getLessonRevision).mockResolvedValue({
            ...revisions[1],
            ...current,
            title: 'Título original',
            unlocks_keys: ['portfolio'],
        })
        renderList()

        fireEvent.click(screen.getAllByRole('button', { name: 'Comparar' })[1])

        expect(await screen.findByText('Restaurar esta revisão mudaria estes campos:')).toBeInTheDocument()
        expect(getLessonRevision).toHaveBeenCalledWith('tok', 'l1', 'r1')
        expect(screen.getByText('Título')).toBeInTheDocument()
        expect(screen.getByText('Título original')).toBeInTheDocument()
        expect(screen.getByText('Título novo')).toBeInTheDocument()
        expect(screen.getByText('Chaves de desbloqueio')).toBeInTheDocument()
        expect(screen.queryByText('Cenário')).not.toBeInTheDocument()
    })

    it('revisão igual ao conteúdo atual avisa', async () => {
        vi.mocked(getLessonRevision).mockResolvedValue({ ...revisions[0], ...current })
        renderList()

        fireEvent.click(screen.getAllByRole('button', { name: 'Comparar' })[0])

        expect(await screen.findByText('Igual ao conteúdo atual.')).toBeInTheDocument()
    })

    it('restaurar pede confirmação e só então chama onRestore com o id', async () => {
        const { onRestore } = renderList()

        fireEvent.click(screen.getAllByRole('button', { name: 'Restaurar' })[1])
        expect(onRestore).not.toHaveBeenCalled()
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restaurar' }))

        await waitFor(() => expect(onRestore).toHaveBeenCalledWith('r1'))
    })
})
