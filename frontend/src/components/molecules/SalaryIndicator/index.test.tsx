import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SalaryIndicator } from '.'

describe('SalaryIndicator (tarefa T.9)', () => {
    it('mostra o valor mensal e os dias até o próximo pagamento', () => {
        render(<SalaryIndicator monthlySalary={350} daysUntilNextPayment={4} />)

        expect(screen.getByText('Salário: R$ 350,00/mês')).toBeInTheDocument()
        expect(screen.getByText('próximo pagamento em 4 dias')).toBeInTheDocument()
    })

    it('com 1 dia, usa singular ("dia", não "dias")', () => {
        render(<SalaryIndicator monthlySalary={350} daysUntilNextPayment={1} />)

        expect(screen.getByText('próximo pagamento em 1 dia')).toBeInTheDocument()
    })

    it('com 0 dias, mostra "hoje"', () => {
        render(<SalaryIndicator monthlySalary={350} daysUntilNextPayment={0} />)

        expect(screen.getByText('próximo pagamento hoje')).toBeInTheDocument()
    })

    it('ainda carregando (undefined), mostra "Carregando…"', () => {
        render(<SalaryIndicator monthlySalary={350} daysUntilNextPayment={undefined} />)

        expect(screen.getByText('Carregando…')).toBeInTheDocument()
    })

    it('sem pagamento futuro na janela (null), não mostra a segunda linha', () => {
        render(<SalaryIndicator monthlySalary={350} daysUntilNextPayment={null} />)

        expect(screen.queryByText(/próximo pagamento/)).not.toBeInTheDocument()
        expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
    })
})
