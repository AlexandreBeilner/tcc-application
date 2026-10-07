import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FgcCoverageBarWidget, fgcCoverageBarSummary } from '.'

const props = { amountPerInstitution: 400_000, institutions: 1, sameConglomerate: false }

describe('FgcCoverageBarWidget', () => {
    it('R$ 400 mil em um banco: cobre R$ 250 mil', () => {
        render(<FgcCoverageBarWidget {...props} />)

        expect(screen.getByText(/Coberto: R\$\s250\.000,00\. Fora da cobertura: R\$\s150\.000,00/)).toBeInTheDocument()
    })

    it('cinco bancos com R$ 250 mil esbarram no teto de R$ 1 milhão', () => {
        render(<FgcCoverageBarWidget {...props} amountPerInstitution={250_000} institutions={5} />)

        expect(screen.getByText(/Coberto: R\$\s1\.000\.000,00/)).toBeInTheDocument()
        expect(screen.getByText(/limite total .* foi o que travou/)).toBeInTheDocument()
    })

    it('mesmo conglomerado soma antes do limite', () => {
        render(<FgcCoverageBarWidget {...props} amountPerInstitution={250_000} institutions={3} />)
        fireEvent.click(screen.getByRole('button', { name: 'Mesmo conglomerado' }))

        expect(screen.getByText(/Coberto: R\$\s250\.000,00\. Fora da cobertura: R\$\s500\.000,00/)).toBeInTheDocument()
    })

    it('o resumo cita os limites', () => {
        expect(fgcCoverageBarSummary(props)).toMatch(/R\$\s250\.000,00 por conglomerado/)
    })
})
