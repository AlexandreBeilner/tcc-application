import { describe, expect, it } from 'vitest'
import type { ComponentHealth } from '../modules/admin/domain/systemHealth'
import type { SchedulerStatus } from '../modules/admin/application/ports/schedulerAdmin'
import type { JobHealth } from '../infra/jobHealth'
import { evaluateReadiness } from './readiness'

const NOW = new Date('2026-10-12T12:00:00Z')
const comp = (key: ComponentHealth['key'], status: ComponentHealth['status']): ComponentHealth => ({
  key,
  status,
  latency_ms: 5,
  detail: null,
})
const job = (name: string, status: JobHealth['status']): JobHealth => ({
  name,
  status,
  lastSuccessAt: null,
  lastFailureAt: null,
  consecutiveFailures: 0,
})
const scheduler = (over: Partial<SchedulerStatus> = {}): SchedulerStatus => ({
  enabled: true,
  paused: false,
  resumed_at: null,
  ticks_per_day: 5,
  timezone: 'America/Sao_Paulo',
  max_catch_up: 3,
  next_slot_at: null,
  tick_in_progress: false,
  last_tick_at: '2026-10-12T10:00:00Z',
  ...over,
})
const base = {
  components: [
    comp('backend', 'ok'),
    comp('engine', 'ok'),
    comp('redis', 'ok'),
    comp('email_outbox', 'ok'),
  ],
  jobs: [job('ranking', 'ok')],
  scheduler: scheduler(),
  now: NOW,
}

describe('evaluateReadiness', () => {
  it('tudo em dia está pronto', () => {
    const result = evaluateReadiness(base)
    expect(result.ok).toBe(true)
    expect(Object.values(result.checks).every((v) => v === 'ok')).toBe(true)
  })

  it('componente fora derruba; latência alta (degradado) não', () => {
    expect(evaluateReadiness({ ...base, components: [comp('engine', 'fora')] }).checks.engine).toBe(
      'fail',
    )
    expect(evaluateReadiness({ ...base, components: [comp('redis', 'degradado')] }).ok).toBe(true)
  })

  it('outbox de e-mail degradado (fila parada) derruba', () => {
    const result = evaluateReadiness({ ...base, components: [comp('email_outbox', 'degradado')] })
    expect(result.ok).toBe(false)
    expect(result.checks.email_outbox).toBe('fail')
  })

  it('job atrasado ou falhando derruba, com o nome do job', () => {
    const result = evaluateReadiness({
      ...base,
      jobs: [job('ranking', 'atrasado'), job('payroll', 'ok')],
    })
    expect(result.ok).toBe(false)
    expect(result.checks['job:ranking']).toBe('fail')
    expect(result.checks['job:payroll']).toBe('ok')
  })

  it('Temporizador parado há mais de 2 intervalos derruba (5 ticks/dia = 4,8 h)', () => {
    const stale = scheduler({ last_tick_at: '2026-10-12T01:00:00Z' }) // 11 h
    expect(evaluateReadiness({ ...base, scheduler: stale }).checks.market_tick).toBe('fail')
    const recent = scheduler({ last_tick_at: '2026-10-12T04:00:00Z' }) // 8 h, dentro de 2x4,8h+30min
    expect(evaluateReadiness({ ...base, scheduler: recent }).checks.market_tick).toBe('ok')
  })

  it('pausa deliberada, agenda desligada, sem tick ainda e motor indisponível não geram falha de tick', () => {
    for (const s of [
      scheduler({ paused: true, last_tick_at: '2026-10-01T00:00:00Z' }),
      scheduler({ enabled: false, last_tick_at: '2026-10-01T00:00:00Z' }),
      scheduler({ last_tick_at: null }),
      null,
    ]) {
      expect(evaluateReadiness({ ...base, scheduler: s }).checks.market_tick).toBeUndefined()
    }
  })
})
