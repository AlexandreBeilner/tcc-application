import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IndicatorSummaryCards } from '.'

describe('IndicatorSummaryCards', () => {
    it('mostra estado de espera quando o motor ainda não gerou nenhum tick', () => {
        render(<IndicatorSummaryCards latest={undefined} nextCopomSimulatedDay={21} />)
        expect(screen.getAllByText('Aguardando a primeira atualização')).toHaveLength(3)
        expect(screen.getByText('Dia 21')).toBeInTheDocument()
    })

    it('formata selic em pontos percentuais e ipca como razão 0-1', () => {
        render(
            <IndicatorSummaryCards
                latest={{ simulated_day: 46, selic_rate: 9.75, ipca_monthly_rate: 0.003758, ipca_accumulated_12m: 0.045321 }}
                nextCopomSimulatedDay={63}
            />,
        )

        expect(screen.getByText('9,8%')).toBeInTheDocument()
        expect(screen.getByText('0.4%')).toBeInTheDocument()
        expect(screen.getByText('4.5%')).toBeInTheDocument()
        expect(screen.getByText('Dia 63')).toBeInTheDocument()
    })
})
