import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAuditLog } from '../../services/admin'
import { AdminAuditoria } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ listAuditLog: vi.fn() }))

function entry(id: string) {
    return {
        id,
        admin_id: 'u1',
        admin_username: 'adminn3',
        action: 'tick.trigger' as const,
        target_type: 'tick',
        target_id: '10',
        payload: { day: 10 },
        result: 'success' as const,
        error_message: null,
        occurred_at: '2026-10-03T14:28:54.580Z',
    }
}

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <AdminAuditoria />
        </QueryClientProvider>,
    )
}

describe('AdminAuditoria (tela 10.4)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('carrega a primeira página sem filtros e mostra o total', async () => {
        vi.mocked(listAuditLog).mockResolvedValue({ entries: [entry('a1')], total_entries: 1 })
        renderPage()

        expect(await screen.findByText('Disparo de tick')).toBeInTheDocument()
        expect(screen.getByText('1 registro(s)')).toBeInTheDocument()
        expect(listAuditLog).toHaveBeenCalledWith('token', { limit: 20, offset: 0 })
    })

    it('mostra erro quando o log não carrega', async () => {
        vi.mocked(listAuditLog).mockRejectedValue(new Error('falhou'))
        renderPage()

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o log agora.')
    })

    it('filtro de resultado refaz a consulta com o valor escolhido e volta pra página 1', async () => {
        vi.mocked(listAuditLog).mockResolvedValue({ entries: [entry('a1')], total_entries: 45 })
        renderPage()
        await screen.findByText('Disparo de tick')

        fireEvent.click(screen.getByLabelText('Filtrar por resultado'))
        fireEvent.click(await screen.findByRole('option', { name: 'Falha' }))

        await waitFor(() => expect(listAuditLog).toHaveBeenLastCalledWith('token', { result: 'failed', limit: 20, offset: 0 }))
    })

    it('paginar pede o offset da página seguinte', async () => {
        vi.mocked(listAuditLog).mockResolvedValue({ entries: [entry('a1')], total_entries: 45 })
        renderPage()
        await screen.findByText('Disparo de tick')

        fireEvent.click(screen.getByLabelText('Próxima página'))

        await waitFor(() => expect(listAuditLog).toHaveBeenLastCalledWith('token', { limit: 20, offset: 20 }))
    })

    it('período invertido avisa e ignora o filtro de datas', async () => {
        vi.mocked(listAuditLog).mockResolvedValue({ entries: [], total_entries: 0 })
        renderPage()
        await screen.findByText('Nenhuma ação administrativa registrada para esse filtro.')

        const [from, to] = Array.from(document.querySelectorAll('input[type="date"]'))
        fireEvent.change(from, { target: { value: '2026-10-05' } })
        fireEvent.change(to, { target: { value: '2026-10-01' } })

        expect(await screen.findByRole('alert')).toHaveTextContent('A data inicial é posterior à final.')
        const lastFilters = vi.mocked(listAuditLog).mock.calls.at(-1)?.[1]
        expect(lastFilters).toEqual({ limit: 20, offset: 0 })
    })
})
