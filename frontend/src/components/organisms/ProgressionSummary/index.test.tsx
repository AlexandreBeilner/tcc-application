import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Progression, Streak } from '../../../services/gamification'
import { ProgressionSummary } from '.'

const progression: Progression = {
    userId: 'user-1',
    xp: 120,
    level: 2,
    currentStreak: 3,
    longestStreak: 5,
    lastQualifyingActivityDate: null,
    monthlySalary: 200,
}
const streak: Streak = { currentStreak: 3, longestStreak: 5 }

describe('ProgressionSummary (tarefa J.4)', () => {
    it('mostra nível/XP e streak', () => {
        render(<ProgressionSummary progression={progression} streak={streak} />)

        expect(screen.getByText('Nível 2')).toBeInTheDocument()
        expect(screen.getByText('120 XP')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('sem nextUnlock, não mostra o indicador de "faltam N lições"', () => {
        render(<ProgressionSummary progression={progression} streak={streak} />)

        expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument()
    })

    it('com nextUnlock, mostra "Faltam N lições pra: descrição"', () => {
        render(
            <ProgressionSummary
                progression={progression}
                streak={streak}
                nextUnlock={{ description: 'Acesso à Trilha 1 (Renda Fixa)', lessonsRemaining: 2 }}
            />,
        )

        expect(screen.getByText(/Faltam 2 lições pra:/)).toBeInTheDocument()
        expect(screen.getByText('Acesso à Trilha 1 (Renda Fixa)')).toBeInTheDocument()
    })

    it('com 1 lição faltando, usa singular ("lição", não "lições")', () => {
        render(
            <ProgressionSummary
                progression={progression}
                streak={streak}
                nextUnlock={{ description: 'Acesso ao Portfólio', lessonsRemaining: 1 }}
            />,
        )

        expect(screen.getByText(/Faltam 1 lição pra:/)).toBeInTheDocument()
    })

    it('nextUnlock null (lições ainda carregando) não mostra o indicador', () => {
        render(<ProgressionSummary progression={progression} streak={streak} nextUnlock={null} />)

        expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument()
    })
})
