import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getAdminRanking } from '../../../services/admin'
import type { AdminRanking } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { AdminRankingPanel } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({ getAdminRanking: vi.fn() }))

const ranking: AdminRanking = {
    window: 'week',
    window_start: '2026-10-05T00:00:00.000Z',
    window_end: '2026-10-11T23:59:59.999Z',
    criterion: 'overall',
    entries: [
        { position: 1, user_id: 'u1', username: 'maria', level: 3, xp: 400, profitability_pct: 12.5 },
        { position: 2, user_id: 'u2', username: 'joao', level: 2, xp: 150, profitability_pct: -1.2 },
        { position: 3, user_id: 'u3', username: 'ana', level: 1, xp: 10, profitability_pct: 0 },
    ],
    page: 1,
    page_size: 25,
    total_entries: 60,
    total_pages: 3,
}

function renderPanel(active = true) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <AdminRankingPanel active={active} />
        </QueryClientProvider>,
    )
}

async function table() {
    return within(await screen.findByRole('table', { hidden: true }))
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getAdminRanking).mockResolvedValue(ranking)
})

describe('AdminRankingPanel', () => {
    it('mostra a janela corrente (semana) e as posições com rentabilidade percentual, só leitura', async () => {
        renderPanel()

        const t = await table()
        expect(await t.findByText('@maria')).toBeInTheDocument()
        expect(t.getByText('+12,50%')).toBeInTheDocument()
        expect(t.getByText('-1,20%')).toBeInTheDocument()
        expect(t.getByText('0,00%')).toBeInTheDocument()
        expect(screen.getByText('Janela corrente: 05/10/2026 a 11/10/2026 (UTC).')).toBeInTheDocument()
        expect(getAdminRanking).toHaveBeenCalledWith('tok', { window: 'week', criterion: 'overall', page: 1 })
        expect(screen.queryByRole('button', { name: /fechar|recalcular/i })).not.toBeInTheDocument()
        expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
    })

    it('troca a janela para mês e volta para a primeira página', async () => {
        renderPanel()
        await table()

        fireEvent.change(screen.getByLabelText('Janela'), { target: { value: 'month' } })

        await waitFor(() => expect(getAdminRanking).toHaveBeenLastCalledWith('tok', { window: 'month', criterion: 'overall', page: 1 }))
    })

    it('no critério de nível não envia janela, desabilita o seletor e mostra o XP', async () => {
        vi.mocked(getAdminRanking).mockResolvedValue({ ...ranking, window: null, window_start: null, window_end: null, criterion: 'level' })
        renderPanel()
        await table()

        fireEvent.change(screen.getByLabelText('Critério'), { target: { value: 'level' } })

        await waitFor(() => expect(getAdminRanking).toHaveBeenLastCalledWith('tok', { window: undefined, criterion: 'level', page: 1 }))
        expect(screen.getByLabelText('Janela')).toBeDisabled()
        expect(await screen.findByText('O nível é cumulativo desde sempre: não usa janela.')).toBeInTheDocument()
        expect((await screen.findAllByText('400 XP')).length).toBeGreaterThan(0)
        expect(screen.queryByText(/Janela corrente/)).not.toBeInTheDocument()
    })

    it('pagina: próxima e anterior, desabilitando nas pontas', async () => {
        renderPanel()
        await table()
        expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
        expect(screen.getByText('Página 1 de 3 · 60 no ranking')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))

        await waitFor(() => expect(getAdminRanking).toHaveBeenLastCalledWith('tok', { window: 'week', criterion: 'overall', page: 2 }))
    })

    it('só consulta quando a aba está ativa', async () => {
        renderPanel(false)

        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(getAdminRanking).not.toHaveBeenCalled()
    })

    it('ranking vazio e erro de carregamento têm mensagem própria', async () => {
        vi.mocked(getAdminRanking).mockResolvedValueOnce({ ...ranking, entries: [], total_entries: 0, total_pages: 0 })
        renderPanel()
        expect(await screen.findByText('Ninguém no ranking neste critério ainda.')).toBeInTheDocument()
    })

    it('mostra erro quando o ranking não carrega', async () => {
        vi.mocked(getAdminRanking).mockRejectedValue(new ApiError(500, 'falha'))
        renderPanel()

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o ranking agora.')
    })
})
