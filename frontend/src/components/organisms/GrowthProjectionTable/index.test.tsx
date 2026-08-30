import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GrowthProjectionTable } from '.'

describe('GrowthProjectionTable', () => {
    it('renderiza uma linha por mês, com as 5 colunas pedidas', () => {
        render(
            <GrowthProjectionTable
                points={[
                    { month: 0, interest: 0, invested: 1000, total: 1000 },
                    { month: 1, interest: 10, invested: 1200, total: 1210 },
                ]}
            />,
        )

        expect(screen.getByText('Mês')).toBeInTheDocument()
        expect(screen.getByText('Juros do mês')).toBeInTheDocument()
        expect(screen.getByText('Total investido')).toBeInTheDocument()
        expect(screen.getByText('Juros acumulados')).toBeInTheDocument()
        expect(screen.getByText('Total acumulado')).toBeInTheDocument()

        const rows = screen.getAllByRole('row')
        // rows[0] é o cabeçalho.
        const month1Row = within(rows[2])
        expect(month1Row.getByText('1')).toBeInTheDocument()
        expect(month1Row.getByText('R$ 1.200,00')).toBeInTheDocument()
        // Juros do mês (10) e juros acumulados (total - investido = 1210 -
        // 1200 = 10) coincidem nesse fixture (só o mês 1), por isso 2x.
        expect(month1Row.getAllByText('R$ 10,00')).toHaveLength(2)
        expect(month1Row.getByText('R$ 1.210,00')).toBeInTheDocument()
    })
})
