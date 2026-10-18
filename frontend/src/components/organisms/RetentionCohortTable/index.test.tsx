import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RetentionCell, RetentionCohort } from '../../../services/admin'
import { RetentionCohortTable } from '.'

const cell = (status: RetentionCell['status'], rate: number | null, measured = 100, size = 100): RetentionCell => ({
    status,
    rate,
    measured,
    size,
})

const COHORTS: RetentionCohort[] = [
    {
        cohort_week: '2026-10-12',
        size: 40,
        returned: { d1: cell('partial', 0.5, 10, 40), d7: cell('in_progress', null, 0, 40), d30: cell('in_progress', null, 0, 40) },
        studied: { d1: cell('partial', 0.2, 10, 40), d7: cell('in_progress', null, 0, 40), d30: cell('in_progress', null, 0, 40) },
    },
    {
        cohort_week: '2026-07-06',
        size: 100,
        returned: { d1: cell('complete', 0.45), d7: cell('complete', 0.15), d30: cell('complete', 0.02) },
        studied: { d1: cell('no_data', null), d7: cell('no_data', null), d30: cell('complete', 0) },
    },
]

describe('RetentionCohortTable (RT.1.3)', () => {
    it('uma linha por semana, com o tamanho e as seis medidas', () => {
        render(<RetentionCohortTable cohorts={COHORTS} />)
        const row = screen.getByRole('row', { name: /06\/07 a 12\/07/ })
        expect(within(row).getByText('100')).toBeInTheDocument()
        expect(within(row).getByText('45,0%')).toBeInTheDocument()
        expect(within(row).getByText('15,0%')).toBeInTheDocument()
        expect(within(row).getByText('2,0%')).toBeInTheDocument()
    })

    it('em andamento e sem dado têm texto próprio, e zero medido continua 0,0%', () => {
        render(<RetentionCohortTable cohorts={COHORTS} />)
        const recent = screen.getByRole('row', { name: /12\/10 a 18\/10/ })
        expect(within(recent).getAllByText('em andamento')).toHaveLength(4)
        const old = screen.getByRole('row', { name: /06\/07 a 12\/07/ })
        expect(within(old).getAllByText('sem dado')).toHaveLength(2)
        expect(within(old).getByText('0,0%')).toBeInTheDocument()
    })

    it('cor por faixa: verde na coluna acima da régua, vermelho abaixo', () => {
        render(<RetentionCohortTable cohorts={COHORTS} />)
        const old = screen.getByRole('row', { name: /06\/07 a 12\/07/ })
        expect(within(old).getByText('45,0%').className).toMatch(/good/)
        expect(within(old).getByText('2,0%').className).toMatch(/low/)
        expect(within(old).getByText('15,0%').className).toMatch(/ok|good/)
    })

    it('coorte parcial ganha asterisco e a explicação de quantos foram medidos', () => {
        render(<RetentionCohortTable cohorts={COHORTS} />)
        const recent = screen.getByRole('row', { name: /12\/10 a 18\/10/ })
        const partial = within(recent).getAllByTitle(/Parcial: medido em 10 de 40 pessoas/)
        expect(partial).toHaveLength(2)
        expect(within(partial[0]).getByLabelText('parcial')).toBeInTheDocument()
    })

    it('a legenda explica as faixas de cada dia e o tracejado', () => {
        render(<RetentionCohortTable cohorts={COHORTS} />)
        const legend = screen.getByRole('list', { name: 'Legenda das faixas' })
        expect(
            within(legend)
                .getByText(/Dia 1:/)
                .closest('li'),
        ).toHaveTextContent('a partir de 40,0%')
        expect(legend).toHaveTextContent('Nunca é 0%')
    })

    it('sem coortes, uma mensagem no lugar da tabela', () => {
        render(<RetentionCohortTable cohorts={[]} />)
        expect(screen.getByText(/Ninguém se cadastrou/)).toBeInTheDocument()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
})
