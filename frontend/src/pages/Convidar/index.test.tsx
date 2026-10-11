import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getMyReferral } from '../../services/referral'
import type { MyReferral } from '../../services/referral'
import { Convidar } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/referral', () => ({ getMyReferral: vi.fn() }))

const referral = (overrides: Partial<MyReferral> = {}): MyReferral => ({
    code: 'ABCD2345',
    qualifiedCount: 3,
    pendingCount: 2,
    next: { threshold: 5, rewardDays: 7, remaining: 2 },
    milestones: [
        { threshold: 5, rewardDays: 7, reached: false, granted: false },
        { threshold: 20, rewardDays: 7, reached: false, granted: false },
        { threshold: 50, rewardDays: 7, reached: false, granted: false },
    ],
    ...overrides,
})

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Convidar />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Convidar (MO.7.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('mostra o link com o código, o progresso e a escada de marcos', async () => {
        vi.mocked(getMyReferral).mockResolvedValue(referral())
        renderPage()

        const input = await screen.findByLabelText('Seu link de convite')
        expect(input).toHaveValue(`${window.location.origin}/login?ref=ABCD2345`)
        expect(screen.getByText('Faltam 2 convites válidos para ganhar 1 semana de PRO.')).toBeInTheDocument()
        expect(screen.getByText('convites válidos')).toBeInTheDocument()
        expect(screen.getByText('amigos ainda na 1ª lição')).toBeInTheDocument()
        expect(screen.getByText('5 convites')).toBeInTheDocument()
        expect(screen.getByText('50 convites')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    })

    it('marca o que foi alcançado e o que já foi concedido', async () => {
        vi.mocked(getMyReferral).mockResolvedValue(
            referral({
                qualifiedCount: 22,
                next: { threshold: 50, rewardDays: 7, remaining: 28 },
                milestones: [
                    { threshold: 5, rewardDays: 7, reached: true, granted: true },
                    { threshold: 20, rewardDays: 7, reached: true, granted: false },
                    { threshold: 50, rewardDays: 7, reached: false, granted: false },
                ],
            }),
        )
        renderPage()

        expect(await screen.findByText('Concedido')).toBeInTheDocument()
        expect(screen.getByText('A caminho')).toBeInTheDocument()
        expect(screen.getByText('Em andamento')).toBeInTheDocument()
    })

    it('copia o link', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        vi.mocked(getMyReferral).mockResolvedValue(referral())
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Copiar link' }))

        await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/login?ref=ABCD2345`))
        expect(await screen.findByRole('button', { name: 'Link copiado' })).toBeInTheDocument()
    })

    it('avisa quando não consegue copiar', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockRejectedValue(new Error('x')) },
            configurable: true,
        })
        vi.mocked(getMyReferral).mockResolvedValue(referral())
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Copiar link' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para copiar')
    })

    it('mostra erro quando a leitura falha', async () => {
        vi.mocked(getMyReferral).mockRejectedValue(new Error('falhou'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar seu convite')
    })
})
