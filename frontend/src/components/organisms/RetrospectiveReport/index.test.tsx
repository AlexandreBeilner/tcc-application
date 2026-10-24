import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import type { Retrospective } from '../../../services/retrospectives'
import { RetrospectiveReport } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../features/retrospective/shareCard', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../features/retrospective/shareCard')>()
    return {
        ...original,
        renderShareBlob: vi.fn().mockResolvedValue(new Blob(['x'])),
        shareOrDownload: vi.fn().mockResolvedValue('downloaded'),
    }
})

import { shareOrDownload } from '../../../features/retrospective/shareCard'

const FULL: Retrospective = {
    month: '2026-09',
    lessonsCompleted: 6,
    achievementsUnlocked: 2,
    achievementNames: ['Primeira Semana', 'Estudioso'],
    level: 5,
    activeDays: [1, 2, 3, 9],
    daysInMonth: 30,
    longestStreak: 3,
    bestReturnPct: 4.2,
    duelsPlayed: 2,
    duelsWon: 1,
    leaguesActive: 1,
    empty: false,
}

const IDENTITY = { username: 'ana', frame: null, title: null }

function renderReport(retro: Retrospective) {
    vi.mocked(useAuth).mockReturnValue({ token: 't' } as ReturnType<typeof useAuth>)
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

    it('mostra métricas, sequência, rentabilidade em percentual, duelos, ligas e o calendário', () => {
        renderReport(FULL)

        expect(screen.getByText('Lições concluídas')).toBeInTheDocument()
        expect(screen.getByText('Conquistas: Primeira Semana, Estudioso.')).toBeInTheDocument()

        expect(screen.getByText('3 dias')).toBeInTheDocument()
        expect(screen.getByText('+4,2%')).toBeInTheDocument()
        expect(screen.getByText('1 de 2')).toBeInTheDocument()
        expect(screen.getByLabelText('Dias do mês')).toBeInTheDocument()
        expect(screen.queryByText(/R\$/)).toBeNull()
    })

    it('mês sem atividade é acolhedor, sem cobrança nem escassez', () => {
        renderReport({ ...FULL, empty: true })
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
