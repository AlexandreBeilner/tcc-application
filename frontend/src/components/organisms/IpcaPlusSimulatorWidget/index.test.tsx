import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IpcaPlusSimulatorWidget, ipcaPlusSimulatorSummary } from '.'

const props = { amount: 1000, realRatePct: 6, years: 2, ipcaPct: 4 }

describe('IpcaPlusSimulatorWidget', () => {
    it('uma linha por ano, com o total composto', () => {
        render(<IpcaPlusSimulatorWidget {...props} />)

        const rows = within(screen.getByRole('table')).getAllByRole('row')
        expect(rows).toHaveLength(3)
        expect(within(rows[2]).getByText(/R\$\s1\.215,29/)).toBeInTheDocument()
    })

    it('mais inflação aumenta o total bruto', () => {
        render(<IpcaPlusSimulatorWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: /Inflação alta/ }))

        expect(screen.getByText(/Bruto no fim: R\$\s1\.3\d\d,\d\d/)).toBeInTheDocument()
    })

    it('explica que o real líquido fica abaixo do anunciado', () => {
        render(<IpcaPlusSimulatorWidget {...props} />)

        expect(screen.getByText(/abaixo dos 6,00% anunciados/)).toBeInTheDocument()
    })

    it('o resumo cita os parâmetros', () => {
        expect(ipcaPlusSimulatorSummary(props)).toMatch(/taxa real de 6,00%/)
    })
})
