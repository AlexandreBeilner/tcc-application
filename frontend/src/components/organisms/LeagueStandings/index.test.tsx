import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LeagueStanding } from '../../../services/leagues'
import { LeagueStandings } from '.'

const NO_COSMETICS = { isPro: false, frame: null, title: null }

function row(overrides: Partial<LeagueStanding>): LeagueStanding {
    return {
        position: 1,
        userId: 'u1',
        username: 'ana',
        name: 'Ana',
        avatarUrl: null,
        level: 3,
        profitabilityPct: 12.5,
        isYou: false,
        cosmetics: NO_COSMETICS,
        ...overrides,
    }
}

describe('LeagueStandings (MO.5.2c)', () => {
    it('mostra posição, rentabilidade percentual e o selo de quem é PRO', () => {
        render(
            <LeagueStandings
                standings={[
                    row({ cosmetics: { isPro: true, frame: 'frame_aurora', title: 'Estrategista' } }),
                    row({ position: 2, userId: 'u2', username: 'bia', name: 'Bia', profitabilityPct: -3.2, isYou: true }),
                ]}
            />,
        )

        expect(screen.getByText('1º')).toBeInTheDocument()
        expect(screen.getByText('+12,5%')).toBeInTheDocument()
        expect(screen.getByText('−3,2%')).toBeInTheDocument()
        expect(screen.getByLabelText('Assinante PRO')).toBeInTheDocument()
        expect(screen.getByText('Estrategista')).toBeInTheDocument()
        expect(screen.getByText('(você)')).toBeInTheDocument()
    })

    it('quem não pôde ser pontuado aparece sem número, nunca some', () => {
        render(<LeagueStandings standings={[row({ profitabilityPct: null })]} />)
        expect(screen.getByText('Sem dado')).toBeInTheDocument()
    })

    it('só o dono vê "Tirar", e nunca em si mesmo', () => {
        const onRemove = vi.fn()
        render(
            <LeagueStandings
                standings={[row({ isYou: true }), row({ position: 2, userId: 'u2', username: 'bia', name: 'Bia' })]}
                onRemove={onRemove}
            />,
        )
        const buttons = screen.getAllByRole('button', { name: 'Tirar' })
        expect(buttons).toHaveLength(1)
        fireEvent.click(buttons[0])
        expect(onRemove).toHaveBeenCalledWith('u2')
    })

    it('sem onRemove não há botão', () => {
        render(<LeagueStandings standings={[row({})]} />)
        expect(screen.queryByRole('button')).toBeNull()
    })
})
