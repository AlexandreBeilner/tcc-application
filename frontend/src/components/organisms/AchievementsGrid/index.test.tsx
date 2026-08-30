import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Achievement } from '../../../services/achievements'
import { AchievementsGrid } from '.'

function achievement(overrides: Partial<Achievement>): Achievement {
    return {
        id: '1',
        name: 'Primeira Semana',
        description: 'Mantenha o streak por 7 dias seguidos.',
        criteriaType: 'streak_days',
        criteriaValue: 7,
        unlocked: false,
        unlockedAt: null,
        progress: 3,
        ...overrides,
    }
}

describe('AchievementsGrid (tela 7.2)', () => {
    it('bloqueada mostra o progresso atual em relação ao critério', () => {
        render(<AchievementsGrid achievements={[achievement({})]} />)

        expect(screen.getByText('Primeira Semana')).toBeInTheDocument()
        expect(screen.getByText('3 de 7 dias')).toBeInTheDocument()
    })

    it('desbloqueada mostra a data de desbloqueio em vez do progresso', () => {
        render(<AchievementsGrid achievements={[achievement({ unlocked: true, unlockedAt: '2026-01-15T10:00:00.000Z', progress: 7 })]} />)

        expect(screen.getByText(/Desbloqueada em 15\/01\/2026/)).toBeInTheDocument()
    })

    it('sem conquistas cadastradas mostra mensagem vazia', () => {
        render(<AchievementsGrid achievements={[]} />)

        expect(screen.getByText('Nenhuma conquista cadastrada ainda.')).toBeInTheDocument()
    })
})
