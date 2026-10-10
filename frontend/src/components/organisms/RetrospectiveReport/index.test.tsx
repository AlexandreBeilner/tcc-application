import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Retrospective } from '../../../services/retrospectives'
import { RetrospectiveReport } from '.'

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

function renderReport(retro: Retrospective, billingEnabled = true) {
    render(
        <MemoryRouter>
            <RetrospectiveReport retrospective={retro} identity={IDENTITY} billingEnabled={billingEnabled} />
        </MemoryRouter>,
    )
}

describe('RetrospectiveReport (MO.5.4)', () => {
    afterEach(() => vi.clearAllMocks())

    it('versão simples mostra as 3 métricas e o convite para o completo, sem cobrança', () => {
        renderReport(FREE)

        expect(screen.getByText('Lições concluídas')).toBeInTheDocument()
        expect(screen.getByText('Conquistas: Primeira Semana, Estudioso.')).toBeInTheDocument()
        expect(screen.queryByText('Maior sequência')).toBeNull()
        expect(screen.queryByLabelText('Dias do mês')).toBeNull()
        expect(screen.getByRole('link', { name: 'Conhecer o PRO' })).toHaveAttribute('href', '/planos')
    })

    it('cobrança desligada não convida', () => {
        renderReport(FREE, false)
        expect(screen.queryByRole('link', { name: 'Conhecer o PRO' })).toBeNull()
    })

    it('versão completa mostra sequência, rentabilidade em percentual, duelos, ligas e o calendário', () => {
        renderReport(FULL)

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
