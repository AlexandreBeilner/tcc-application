import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SocialFeedEvent } from '../../../services/socialfeed'
import { RecentActivityFeed } from '.'

const bia: SocialFeedEvent = {
    type: 'track_completed',
    trackNumber: 1,
    duel: null,
    assembly: null,
    occurredAt: '2026-02-10T00:00:00.000Z',
    userId: 'u2',
    username: 'bia',
    name: 'Bia Souza',
    avatarUrl: null,
    cosmetics: { frame: null, title: null },
}

describe('RecentActivityFeed (backlog engajamento G.2)', () => {
    it('sem eventos mostra estado vazio, não escondido', () => {
        render(<RecentActivityFeed events={[]} />)

        expect(screen.getByText('Atividade recente')).toBeInTheDocument()
        expect(
            screen.getByText(
                'Quando seus amigos concluírem uma trilha, vencerem um duelo ou participarem de uma assembleia, aparece por aqui.',
            ),
        ).toBeInTheDocument()
    })

    it('mostra o evento de trilha concluída em tom de celebração, sem número sensível', () => {
        render(<RecentActivityFeed events={[bia]} />)

        expect(screen.getByText('Bia Souza')).toBeInTheDocument()
        expect(screen.getByText(/completou a Trilha 1: Renda Fixa/)).toBeInTheDocument()
        expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
        expect(screen.queryByText('%')).not.toBeInTheDocument()
    })

    it('resultado de duelo celebra quem venceu, sem percentual nem derrota (MO.5.3)', () => {
        const won: SocialFeedEvent = {
            ...bia,
            type: 'duel_won',
            trackNumber: null,
            duel: { duelId: 'd1', opponentUsername: 'caio', opponentName: 'Caio Lima', reason: 'profitability' },
        }
        const draw: SocialFeedEvent = {
            ...won,
            type: 'duel_draw',
            duel: { duelId: 'd2', opponentUsername: 'caio', opponentName: 'Caio Lima', reason: 'tie' },
        }
        render(<RecentActivityFeed events={[won, draw]} />)

        expect(screen.getByText(/venceu um duelo contra Caio Lima/)).toBeInTheDocument()
        expect(screen.getByText(/empatou um duelo com Caio Lima/)).toBeInTheDocument()
        expect(screen.queryByText(/%/)).not.toBeInTheDocument()
        expect(screen.queryByText(/perdeu/i)).not.toBeInTheDocument()
    })

    it('participação em assembleia mostra a pauta, sem voto, desfecho nem valores (MO.6.7)', () => {
        const participated: SocialFeedEvent = {
            ...bia,
            type: 'assembly_participated',
            trackNumber: null,
            assembly: { assemblyId: 'a1', subjectLabel: 'Acme', title: 'Orçamento de capital', outcome: 'approved' },
        }
        render(<RecentActivityFeed events={[participated]} />)

        expect(screen.getByText(/participou da assembleia de Acme: Orçamento de capital/)).toBeInTheDocument()
        expect(screen.queryByText(/completou a Trilha/)).not.toBeInTheDocument()
        expect(screen.queryByText(/aprovad|rejeitad|votou/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/R\$|%/)).not.toBeInTheDocument()
    })
})
