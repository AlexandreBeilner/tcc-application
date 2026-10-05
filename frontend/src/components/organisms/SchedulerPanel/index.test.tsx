import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SchedulerStatus } from '../../../services/admin'
import { SchedulerPanel } from '.'

const status: SchedulerStatus = {
    enabled: true,
    paused: false,
    resumed_at: null,
    ticks_per_day: 5,
    timezone: 'America/Sao_Paulo',
    max_catch_up: 3,
    next_slot_at: '2026-10-03T15:00:00Z',
    tick_in_progress: false,
    last_tick_at: '2026-10-03T10:00:00Z',
}

function renderPanel(overrides: Partial<SchedulerStatus> = {}, busy = false) {
    const handlers = { onTogglePause: vi.fn(), onTriggerTick: vi.fn(), onAdvance: vi.fn() }
    render(<SchedulerPanel status={{ ...status, ...overrides }} busy={busy} {...handlers} />)
    return handlers
}

describe('SchedulerPanel (N.6)', () => {
    it('agenda ativa: mostra o estado, o ritmo e oferece Pausar', () => {
        renderPanel()
        expect(screen.getByText('Ativa')).toBeInTheDocument()
        expect(screen.getByText('5 ticks por dia real (America/Sao_Paulo)')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Pausar agenda' })).toBeEnabled()
    })

    it('pausada: mostra "Pausada", próximo tick como Pausado e oferece Retomar', () => {
        renderPanel({ paused: true, next_slot_at: null, resumed_at: '2026-10-03T09:00:00Z' })
        expect(screen.getByText('Pausada')).toBeInTheDocument()
        expect(screen.getByText('Pausado')).toBeInTheDocument()
        expect(screen.getByText('Retomada em')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Retomar agenda' })).toBeInTheDocument()
    })

    it('agenda desligada no ambiente: avisa e desabilita pausar, mas o tick manual segue disponível', () => {
        renderPanel({ enabled: false, next_slot_at: null })
        expect(screen.getByText('Desligada neste ambiente')).toBeInTheDocument()
        expect(screen.getByText(/TICK_SCHEDULER_ENABLED=false/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Pausar agenda' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Disparar 1 tick' })).toBeEnabled()
    })

    it('tick em andamento aparece destacado', () => {
        renderPanel({ tick_in_progress: true })
        expect(screen.getByText('Tick em andamento')).toBeInTheDocument()
    })

    it('ocupado trava todos os botões', () => {
        renderPanel({}, true)
        for (const name of ['Pausar agenda', 'Disparar 1 tick', 'Avançar']) {
            expect(screen.getByRole('button', { name })).toBeDisabled()
        }
    })

    it('os botões chamam os callbacks e Avançar leva os dias digitados', () => {
        const handlers = renderPanel()
        fireEvent.click(screen.getByRole('button', { name: 'Pausar agenda' }))
        fireEvent.click(screen.getByRole('button', { name: 'Disparar 1 tick' }))
        fireEvent.change(screen.getByLabelText('Avançar dias do mercado'), { target: { value: '12' } })
        fireEvent.click(screen.getByRole('button', { name: 'Avançar' }))
        expect(handlers.onTogglePause).toHaveBeenCalledTimes(1)
        expect(handlers.onTriggerTick).toHaveBeenCalledTimes(1)
        expect(handlers.onAdvance).toHaveBeenCalledWith(12)
    })

    it.each(['0', '31', '1.5', '', '-2'])('dias "%s" desabilita Avançar e mostra a dica', (value) => {
        const handlers = renderPanel()
        fireEvent.change(screen.getByLabelText('Avançar dias do mercado'), { target: { value } })
        expect(screen.getByRole('button', { name: 'Avançar' })).toBeDisabled()
        expect(screen.getByText('Informe de 1 a 30 dias.')).toBeInTheDocument()
        expect(handlers.onAdvance).not.toHaveBeenCalled()
    })
})
