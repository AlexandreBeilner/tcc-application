import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import type { Retrospective } from '../../../services/retrospectives'
import { RetrospectiveReport } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../../features/retrospective/shareCard', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../features/retrospective/shareCard')>()
    return {
        ...original,
        renderShareBlob: vi.fn().mockResolvedValue(new Blob(['x'])),
        shareOrDownload: vi.fn().mockResolvedValue('downloaded'),
    }
})

import { shareOrDownload } from '../../../features/retrospective/shareCard'

const FREE: Retrospective = {
    month: '2026-09',
    full: false,
    lessonsCompleted: 6,
    achievementsUnlocked: 2,
    achievementNames: ['Primeira Semana', 'Estudioso'],
    level: 5,
    premium: null,
    empty: false,
}

const FULL: Retrospective = {
    ...FREE,
    full: true,
    premium: {
        activeDays: [1, 2, 3, 9],
        daysInMonth: 30,
        longestStreak: 3,
        bestReturnPct: 4.2,
        duelsPlayed: 2,
        duelsWon: 1,
        leaguesActive: 1,
    },
}

const IDENTITY = { username: 'ana', isPro: false, frame: null, title: null }

const FREE_PLAN: BillingStatus = {
    isPro: false,
    state: 'none',
    plan: null,
    store: null,
    expiresAt: null,
    willRenew: false,
    managementUrl: null,
    billingEnabled: true,
}

function renderReport(retro: Retrospective, billing: Partial<BillingStatus> = {}) {
    vi.mocked(useAuth).mockReturnValue({ token: 't' } as ReturnType<typeof useAuth>)
    vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE_PLAN, ...billing })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <RetrospectiveReport retrospective={retro} identity={IDENTITY} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('RetrospectiveReport (MO.5.4)', () => {
    afterEach(() => vi.clearAllMocks())

    it('versão simples mostra as 3 métricas e o convite para o completo, sem cobrança', async () => {
        renderReport(FREE)

        expect(screen.getByText('Lições concluídas')).toBeInTheDocument()
        expect(screen.getByText('Conquistas: Primeira Semana, Estudioso.')).toBeInTheDocument()
        expect(screen.queryByText('Maior sequência')).toBeNull()
        expect(screen.queryByLabelText('Dias do mês')).toBeNull()
        expect(await screen.findByRole('link', { name: 'Conhecer o PRO' })).toHaveAttribute('href', '/planos')
    })

    it('cobrança desligada não convida', async () => {
        renderReport(FREE, { billingEnabled: false })
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        expect(screen.queryByRole('link', { name: 'Conhecer o PRO' })).toBeNull()
    })

    it('versão completa mostra sequência, rentabilidade em percentual, duelos, ligas e o calendário', () => {
        renderReport(FULL, { isPro: true, state: 'active' })

        expect(screen.getByText('3 dias')).toBeInTheDocument()
        expect(screen.getByText('+4,2%')).toBeInTheDocument()
        expect(screen.getByText('1 de 2')).toBeInTheDocument()
        expect(screen.getByLabelText('Dias do mês')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Conhecer o PRO' })).toBeNull()
        expect(screen.queryByText(/R\$/)).toBeNull()
    })

    it('mês sem atividade é acolhedor, sem cobrança nem escassez', () => {
        renderReport({ ...FREE, empty: true })
        expect(screen.getByText(/Sem problema: quando voltar/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Compartilhar/ })).toBeNull()
    })

    it('compartilhar gera a imagem e avisa o resultado', async () => {
        renderReport(FULL)
        fireEvent.click(screen.getByRole('button', { name: 'Compartilhar imagem' }))

        await waitFor(() => expect(shareOrDownload).toHaveBeenCalled())
        expect(vi.mocked(shareOrDownload).mock.calls[0][2]).toBe('retrospectiva-2026-09.png')
        expect(await screen.findByText('Imagem salva no seu aparelho.')).toBeInTheDocument()
    })
})
