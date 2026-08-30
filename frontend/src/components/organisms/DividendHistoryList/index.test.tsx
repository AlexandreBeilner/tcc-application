import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DividendHistoryList } from '.'

describe('DividendHistoryList', () => {
    it('mostra estado vazio quando o ativo nunca pagou provento', () => {
        render(<DividendHistoryList history={[]} />)
        expect(screen.getByText('Este ativo ainda não pagou nenhum provento.')).toBeInTheDocument()
    })

    it('lista um item por provento, mais recente primeiro (ordem da resposta)', () => {
        render(
            <DividendHistoryList
                history={[
                    { value_per_share: 0.5, ex_date: '2026-01-01T00:00:00Z', payment_date: '2026-01-10T00:00:00Z' },
                    { value_per_share: 0.3, ex_date: '2025-10-01T00:00:00Z', payment_date: '2025-10-10T00:00:00Z' },
                ]}
            />,
        )
        expect(screen.getByText('R$ 0,50 / cota')).toBeInTheDocument()
        expect(screen.getByText('R$ 0,30 / cota')).toBeInTheDocument()
    })
})
