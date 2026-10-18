import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { createDailyEvent, getDailyEvents } from '../../../services/admin'
import type { DailyEvent } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { AdminDailyEvents } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({ getDailyEvents: vi.fn(), createDailyEvent: vi.fn(), updateDailyEvent: vi.fn() }))

const event = (id: string, year: number, label: string): DailyEvent => ({
    id,
    stable_key: `e:${id}`,
    year,
    label,
    explanation: 'Explicação.',
    source_ref: 'Banco Central do Brasil',
    learn_more: null,
    category: 'planos-e-moeda',
    scope: 'brasil',
    active: true,
})

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <AdminDailyEvents />
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getDailyEvents).mockResolvedValue({ events: [event('e2', 2008, 'Crise global'), event('e1', 1994, 'Plano Real')] })
})

describe('AdminDailyEvents', () => {
    it('lista em ordem cronológica e filtra pela busca', async () => {
        renderPanel()

        const items = await screen.findAllByRole('listitem')
        expect(items[0]).toHaveTextContent('1994 · Plano Real')
        expect(items[1]).toHaveTextContent('2008 · Crise global')
        fireEvent.change(screen.getByLabelText('Buscar evento'), { target: { value: '2008' } })
        expect(screen.queryByText(/Plano Real/)).not.toBeInTheDocument()
    })

    it('cria evento com o ano numérico e mostra a recusa do nome que entrega o ano', async () => {
        vi.mocked(createDailyEvent).mockRejectedValue(
            new ApiError(422, 'evento: o nome entrega o ano', {
                code: 'invalid_daily_content',
                problems: ['evento m-1: o nome entrega o ano'],
            }),
        )
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Novo evento' }))
        fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '1994' } })
        fireEvent.change(screen.getByLabelText('Nome curto'), { target: { value: 'Real de 1994' } })
        fireEvent.change(screen.getByLabelText(/^Por que importou/), { target: { value: 'A moeda nova entrou em circulação.' } })
        fireEvent.change(screen.getByLabelText('Fonte primária'), { target: { value: 'Lei 8.880/1994' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

        await waitFor(() =>
            expect(createDailyEvent).toHaveBeenCalledWith(
                'tok',
                expect.objectContaining({ year: 1994, label: 'Real de 1994', source_ref: 'Lei 8.880/1994' }),
            ),
        )
        expect(await screen.findByRole('alert')).toHaveTextContent('o nome entrega o ano')
    })
})
