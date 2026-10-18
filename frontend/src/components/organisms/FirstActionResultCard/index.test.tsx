import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { listLessons } from '../../../services/lessons'
import { getAssetBook, getMyAccount } from '../../../services/market'
import { FirstActionResultCard } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/lessons', () => ({ listLessons: vi.fn() }))
vi.mock('../../../services/market', () => ({ getMyAccount: vi.fn(), getAssetBook: vi.fn() }))

const sandboxPosition = {
    assetId: 'sand-id',
    ticker: 'SAND3',
    name: 'Ação de Treino',
    type: 'acao' as const,
    isSandbox: true,
    quantity: 5,
    averagePrice: 100,
    dividendsReceived: 0,
}

function accountWith(positions: (typeof sandboxPosition)[]) {
    return { cashBalance: 10000, totalInvested: 0, totalDividendsReceived: 0, positions, fixedIncomePositions: [] }
}

function bookAt(price: number) {
    return { book: { is_sandbox: true, price, best_bid: null, best_ask: null, mid_price: null, bids: null, asks: null } }
}

function renderCard() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/', element: <FirstActionResultCard /> },
            { path: '/trilha/:id', element: <div>tela da lição</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('FirstActionResultCard (OB.1.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'a@b.c', username: 'ana', role: 'user', onboardingCompleted: true, avatarUrl: null },
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [{ id: 'lesson-25', code: '2.5', title: 'Oferta e demanda', status: 'locked' }],
        } as never)
    })

    afterEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('mostra o resultado quando o roteiro já andou e leva à lição que explica por que o preço mexe', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(accountWith([sandboxPosition]))
        vi.mocked(getAssetBook).mockResolvedValue(bookAt(103))

        renderCard()

        expect(await screen.findByText('+3,0%')).toBeInTheDocument()
        expect(screen.getByText(/hoje ela vale/)).toHaveTextContent('R$ 100,00')
        expect(screen.getByText(/hoje ela vale/)).toHaveTextContent('R$ 103,00')

        await waitFor(() => expect(listLessons).toHaveBeenCalled())
        fireEvent.click(screen.getByRole('button', { name: 'Ver por que o preço mexe' }))
        expect(await screen.findByText('tela da lição')).toBeInTheDocument()
    })

    it('não aparece enquanto o preço de hoje é o mesmo da compra', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(accountWith([sandboxPosition]))
        vi.mocked(getAssetBook).mockResolvedValue(bookAt(100))

        renderCard()

        await waitFor(() => expect(getAssetBook).toHaveBeenCalled())
        expect(screen.queryByText('Sua primeira ação')).not.toBeInTheDocument()
    })

    it('não aparece para quem nunca comprou a ação de treino', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(accountWith([]))

        renderCard()

        await waitFor(() => expect(getMyAccount).toHaveBeenCalled())
        expect(getAssetBook).not.toHaveBeenCalled()
        expect(screen.queryByText('Sua primeira ação')).not.toBeInTheDocument()
    })

    it('"Entendi" esconde o cartão e ele não volta no próximo acesso', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(accountWith([sandboxPosition]))
        vi.mocked(getAssetBook).mockResolvedValue(bookAt(103))

        const first = renderCard()
        fireEvent.click(await screen.findByRole('button', { name: 'Entendi' }))
        expect(screen.queryByText('Sua primeira ação')).not.toBeInTheDocument()
        first.unmount()

        renderCard()
        await waitFor(() => expect(getMyAccount).toHaveBeenCalledTimes(2))
        expect(screen.queryByText('Sua primeira ação')).not.toBeInTheDocument()
    })
})
