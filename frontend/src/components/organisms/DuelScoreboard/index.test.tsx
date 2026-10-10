import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Duel } from '../../../services/duels'
import { DuelScoreboard } from '.'

const NO_COSMETICS = { isPro: false, frame: null, title: null }

function duel(overrides: Partial<Duel>): Duel {
    return {
        id: 'd1',
        status: 'finished',
        role: 'challenger',
        opponent: {
            id: 'u2',
            username: 'bia',
            name: 'Bia',
            avatarUrl: null,
            cosmetics: { isPro: true, frame: 'frame_aurora', title: 'Estrategista' },
        },
        createdAt: '2026-10-01T00:00:00Z',
        expiresAt: '2026-10-08T00:00:00Z',
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-10-08T00:00:00Z',
        finishedAt: '2026-10-08T01:00:00Z',
        result: 'won',
        reason: 'profitability',
        you: { returnPct: 5.5, operated: true },
        them: { returnPct: -1.2, operated: true },
        ...overrides,
    }
}

const YOU = { username: 'ana', avatarUrl: null, frame: null }

describe('DuelScoreboard (MO.5.3)', () => {
    it('encerrado mostra os dois percentuais, o motivo e o selo do adversário', () => {
        render(<DuelScoreboard duel={duel({})} you={YOU} />)

        expect(screen.getByText('+5,5%')).toBeInTheDocument()
        expect(screen.getByText('−1,2%')).toBeInTheDocument()
        expect(screen.getByText('Venceu quem teve a maior rentabilidade no período.')).toBeInTheDocument()
        expect(screen.getByLabelText('Assinante PRO')).toBeInTheDocument()
        expect(screen.getByText('Estrategista')).toBeInTheDocument()
    })

    it('abandono explica a regra e mostra quem não operou', () => {
        render(<DuelScoreboard duel={duel({ reason: 'abandonment', them: { returnPct: 0, operated: false } })} you={YOU} />)
        expect(screen.getByText('Quem não operou durante o duelo perde por abandono.')).toBeInTheDocument()
        expect(screen.getByText('Ainda não operou')).toBeInTheDocument()
    })

    it('empate usa o texto de empate', () => {
        render(<DuelScoreboard duel={duel({ result: 'draw', reason: 'tie' })} you={YOU} />)
        expect(screen.getByText('A rentabilidade foi a mesma, então é empate.')).toBeInTheDocument()
    })

    it('em andamento mostra o parcial e lembra que é preciso operar', () => {
        render(<DuelScoreboard duel={duel({ status: 'active', result: null, reason: null })} you={YOU} />)
        expect(screen.getByText(/Placar parcial de agora/)).toBeInTheDocument()
    })

    it('sem placar (falha ao medir) não quebra a tela', () => {
        render(<DuelScoreboard duel={duel({ status: 'active', result: null, reason: null, you: null, them: null })} you={YOU} />)
        expect(screen.getAllByText('Sem placar ainda')).toHaveLength(2)
    })

    it('nunca mostra patrimônio em reais', () => {
        render(<DuelScoreboard duel={duel({})} you={YOU} />)
        expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
        void NO_COSMETICS
    })
})
