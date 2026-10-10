import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TradingHalt } from '../../../services/admin'
import { TradingHaltList } from '.'

const active: TradingHalt = {
    id: 'h1',
    scope: 'asset',
    asset_id: 'a1',
    ticker: 'ACME3',
    reason: 'volatilidade',
    created_by: 'admin-1',
    created_at: '2026-10-03T12:00:00Z',
    lifted_at: null,
    lifted_by: null,
}
const lifted: TradingHalt = {
    ...active,
    id: 'h2',
    scope: 'global',
    asset_id: null,
    ticker: null,
    lifted_at: '2026-10-03T13:00:00Z',
    lifted_by: 'admin-1',
}

describe('TradingHaltList', () => {
    it('mostra a mensagem vazia sem pausas', () => {
        render(<TradingHaltList halts={[]} emptyMessage="Nenhuma pausa." />)
        expect(screen.getByText('Nenhuma pausa.')).toBeInTheDocument()
    })

    it('pausa vigente mostra escopo, motivo e Retomar', () => {
        const onLift = vi.fn()
        render(<TradingHaltList halts={[active]} onLift={onLift} emptyMessage="" />)
        expect(screen.getByText('Vigente')).toBeInTheDocument()
        expect(screen.getByText('ACME3')).toBeInTheDocument()
        expect(screen.getByText('Motivo: volatilidade')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Retomar' }))
        expect(onLift).toHaveBeenCalledWith(active)
    })

    it('pausa encerrada global não tem Retomar e mostra a data da retomada', () => {
        render(<TradingHaltList halts={[lifted]} onLift={vi.fn()} emptyMessage="" />)
        expect(screen.getByText('Encerrada')).toBeInTheDocument()
        expect(screen.getByText('Todo o mercado')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Retomar' })).not.toBeInTheDocument()
        expect(screen.getByText(/retomada em/)).toBeInTheDocument()
    })

    it('trava só o Retomar da pausa em andamento', () => {
        render(<TradingHaltList halts={[active]} onLift={vi.fn()} liftingId="h1" emptyMessage="" />)
        expect(screen.getByRole('button', { name: 'Retomar' })).toBeDisabled()
    })
})
