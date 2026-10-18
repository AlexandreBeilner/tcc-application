import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AdminRetention } from '../../../services/admin'
import { MilestoneCards } from '.'

const DATA: AdminRetention['milestones'] = {
    tracking_since: '2026-06-02',
    eligible: 200,
    milestones: [
        { milestone: 'first_return', granularity: 'day', reached: 90, reached_rate: 0.45, median_seconds: 2 * 86_400 },
        { milestone: 'first_lesson', granularity: 'second', reached: 140, reached_rate: 0.7, median_seconds: 5 * 3600 },
        { milestone: 'first_trade', granularity: 'second', reached: 60, reached_rate: 0.3, median_seconds: 3 * 86_400 },
        { milestone: 'first_fixed_income', granularity: 'second', reached: 0, reached_rate: 0, median_seconds: null },
        { milestone: 'first_daily', granularity: 'second', reached: 40, reached_rate: 0.2, median_seconds: 1800 },
    ],
    cohorts: [
        {
            cohort_week: '2026-10-12',
            size: 30,
            status: 'in_progress',
            rates: { first_return: 0.3, first_lesson: 0.5, first_trade: 0.1, first_fixed_income: 0, first_daily: 0.1 },
        },
        {
            cohort_week: '2026-06-08',
            size: 170,
            status: 'complete',
            rates: { first_return: 0.5, first_lesson: 0.75, first_trade: 0.34, first_fixed_income: 0, first_daily: 0.23 },
        },
    ],
}

describe('MilestoneCards (RT.1.3)', () => {
    it('um cartão por marco, com o tempo mediano e quantos chegaram', () => {
        render(<MilestoneCards data={DATA} />)
        const cards = within(screen.getByRole('list', { name: 'Tempo até cada marco' })).getAllByRole('listitem')
        expect(cards).toHaveLength(5)
        expect(cards[0]).toHaveTextContent('Voltou depois do cadastro')
        expect(cards[0]).toHaveTextContent('2 dias')
        expect(cards[1]).toHaveTextContent('5 h')
        expect(cards[1]).toHaveTextContent('70,0% chegaram (140 de 200)')
        expect(cards[3]).toHaveTextContent('sem dado')
        expect(cards[4]).toHaveTextContent('30 min')
    })

    it('explica quem entra na conta e que operação de treino não conta', () => {
        render(<MilestoneCards data={DATA} />)
        expect(screen.getByText(/a partir de 02\/06/)).toBeInTheDocument()
        expect(screen.getByText(/nunca as operações de treino/)).toBeInTheDocument()
    })

    it('a % por coorte fica numa tabela, com a coorte recente marcada como subindo', () => {
        render(<MilestoneCards data={DATA} />)
        const recent = screen.getByRole('row', { name: /12\/10 a 18\/10/ })
        expect(within(recent).getAllByTitle(/ainda está subindo/)).toHaveLength(5)
        const old = screen.getByRole('row', { name: /08\/06 a 14\/06/ })
        expect(within(old).getByText('75,0%')).toBeInTheDocument()
        expect(within(old).queryByTitle(/ainda está subindo/)).not.toBeInTheDocument()
    })

    it('sem elegíveis, diz que ainda não há dado e desde quando o registro conta', () => {
        render(<MilestoneCards data={{ ...DATA, eligible: 0, milestones: [], cohorts: [] }} />)
        expect(screen.getByText(/Ainda sem dado de marcos/)).toBeInTheDocument()
        expect(screen.queryByRole('list', { name: 'Tempo até cada marco' })).not.toBeInTheDocument()
    })
})
