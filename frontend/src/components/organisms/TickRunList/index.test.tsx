import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TickRun } from '../../../services/admin'
import { TickRunList } from '.'

const ok: TickRun = {
    simulated_day: 12,
    trigger: 'scheduled',
    status: 'success',
    error_message: null,
    started_at: '2026-10-03T12:00:00Z',
    duration_ms: 1500,
    catch_up_discarded: 0,
    selic_rate: 10.5,
    is_copom_day: true,
    is_report_day: false,
    quotes_count: 24,
    fundamentals_count: 0,
    dividends_generated_count: 2,
    dividends_paid_count: 1,
    bot_fills_count: 7,
    expired_orders_count: 3,
    uncovered_assets_count: 0,
    intraday_rounds_count: 3,
}

const failed: TickRun = {
    ...ok,
    simulated_day: null,
    trigger: 'manual',
    status: 'failed',
    error_message: 'banco caiu',
    selic_rate: null,
    duration_ms: 20,
}

describe('TickRunList (N.6)', () => {
    it('lista vazia mostra mensagem', () => {
        render(<TickRunList ticks={[]} />)
        expect(screen.getByText('Nenhum tick registrado ainda.')).toBeInTheDocument()
    })

    it('mostra dia, gatilho, resultado e duração formatada', () => {
        render(<TickRunList ticks={[ok, failed]} />)
        expect(screen.getByText('Dia 12')).toBeInTheDocument()
        expect(screen.getByText('Sem dia')).toBeInTheDocument()
        expect(screen.getByText('Agendado')).toBeInTheDocument()
        expect(screen.getByText('Manual')).toBeInTheDocument()
        expect(screen.getByText('Sucesso')).toBeInTheDocument()
        expect(screen.getByText('Falha')).toBeInTheDocument()
        expect(screen.getByText('1,5 s')).toBeInTheDocument()
        expect(screen.getByText('20 ms')).toBeInTheDocument()
    })

    it('detalhe do sucesso traz os contadores e a Selic; Copom sinalizado', () => {
        render(<TickRunList ticks={[ok]} />)
        expect(screen.getByText('Negócios de bots').nextSibling).toHaveTextContent('7')
        expect(screen.getByText('Proventos gerados / pagos').nextSibling).toHaveTextContent('2 / 1')
        expect(screen.getByText('10,50%')).toBeInTheDocument()
        expect(screen.getByText(/Dia de Copom/)).toBeInTheDocument()
    })

    it('falha mostra o motivo e não mostra contadores', () => {
        render(<TickRunList ticks={[failed]} />)
        expect(screen.getByText('Motivo: banco caiu')).toBeInTheDocument()
        expect(screen.queryByText('Negócios de bots')).not.toBeInTheDocument()
    })

    it('recuperação mostra o descarte do limite de catch-up', () => {
        render(<TickRunList ticks={[{ ...ok, trigger: 'catchup', catch_up_discarded: 9 }]} />)
        expect(screen.getByText('Recuperação')).toBeInTheDocument()
        expect(screen.getByText('9 tick(s) atrasado(s) descartado(s) pelo limite de recuperação.')).toBeInTheDocument()
    })
})
