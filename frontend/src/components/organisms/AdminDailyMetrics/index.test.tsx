import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getDailyMetrics } from '../../../services/admin'
import type { DailyMetricsDay } from '../../../services/admin'
import { sumMetrics } from '../../../features/admin/dailyAdmin'
import { AdminDailyMetrics } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({ getDailyMetrics: vi.fn() }))

const day = (date: string, over: Partial<DailyMetricsDay> = {}): DailyMetricsDay => ({
    date,
    anon_started: 0,
    anon_completed: 0,
    logged_started: 0,
    logged_completed: 0,
    signups: 0,
    logins: 0,
    ...over,
})

function renderIt() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <AdminDailyMetrics />
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
})

describe('sumMetrics', () => {
    it('soma cada coluna', () => {
        expect(
            sumMetrics([day('2026-11-10', { anon_started: 3, signups: 1 }), day('2026-11-09', { anon_started: 2, logged_completed: 4 })]),
        ).toEqual({
            anon_started: 5,
            anon_completed: 0,
            logged_started: 0,
            logged_completed: 4,
            signups: 1,
            logins: 0,
        })
    })
})

describe('AdminDailyMetrics', () => {
    it('mostra os totais do período e uma linha por dia', async () => {
        vi.mocked(getDailyMetrics).mockResolvedValue({
            days: [
                day('2026-11-10', { anon_started: 7, anon_completed: 5, logged_started: 3, logged_completed: 2, signups: 1 }),
                day('2026-11-09'),
            ],
        })
        renderIt()

        const totals = await screen.findByLabelText('Totais do período')
        expect(within(totals).getByText('Sem conta: iniciados').nextElementSibling).toHaveTextContent('7')
        expect(within(totals).getByText('Cadastros do Diário').nextElementSibling).toHaveTextContent('1')
        const table = screen.getByRole('table')
        expect(within(table).getByRole('rowheader', { name: '10/11' })).toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: '09/11' })).toBeInTheDocument()
        expect(getDailyMetrics).toHaveBeenCalledWith('tok', 30)
    })

    it('falha da API mostra aviso e não quebra a tela', async () => {
        vi.mocked(getDailyMetrics).mockRejectedValue(new Error('x'))
        renderIt()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a medição')
    })
})
