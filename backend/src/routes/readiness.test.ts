import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordJobFailure, registerJob, resetJobHealthForTests } from '../infra/jobHealth'
import { createReadinessRouter } from './readiness'

const components = (outbox: 'ok' | 'degradado' = 'ok') => ({
  checked_at: '2026-10-12T12:00:00Z',
  components: [
    { key: 'backend', status: 'ok', latency_ms: 0, detail: null },
    { key: 'engine', status: 'ok', latency_ms: 4, detail: null },
    { key: 'email_outbox', status: outbox, latency_ms: 2, detail: 'segredo-interno: postgres://x' },
  ],
})

function build(
  opts: { outbox?: 'ok' | 'degradado'; schedulerFails?: boolean; clock?: { t: number } } = {},
) {
  const clock = opts.clock ?? { t: Date.parse('2026-10-12T12:00:00Z') }
  const getSystemHealth = { execute: vi.fn(async () => components(opts.outbox)) }
  const getSchedulerStatus = {
    execute: vi.fn(async () => {
      if (opts.schedulerFails) throw new Error('motor fora')
      return {
        enabled: true,
        paused: false,
        resumed_at: null,
        ticks_per_day: 5,
        timezone: 'America/Sao_Paulo',
        max_catch_up: 3,
        next_slot_at: null,
        tick_in_progress: false,
        last_tick_at: '2026-10-12T11:00:00Z',
      }
    }),
  }
  const app = express()
  app.use(
    createReadinessRouter({
      getSystemHealth: getSystemHealth as never,
      getSchedulerStatus: getSchedulerStatus as never,
      now: () => new Date(clock.t),
    }),
  )
  return { app, getSystemHealth, clock }
}

beforeEach(() => resetJobHealthForTests())

describe('GET /health/ready', () => {
  it('200 quando tudo está em dia, só com nomes e ok/fail', async () => {
    const { app } = build()
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.checks).toMatchObject({
      backend: 'ok',
      engine: 'ok',
      email_outbox: 'ok',
      market_tick: 'ok',
    })
  })

  it('503 com o nome da verificação que falhou e sem vazar o detalhe interno', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { app } = build({ outbox: 'degradado' })
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(503)
    expect(res.body.checks.email_outbox).toBe('fail')
    expect(JSON.stringify(res.body)).not.toContain('postgres://')
  })

  it('503 quando um job do backend falha 3 vezes seguidas', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerJob('ranking', 3_600_000)
    for (let i = 0; i < 3; i++) recordJobFailure('ranking')
    const res = await request(build().app).get('/health/ready')
    expect(res.status).toBe(503)
    expect(res.body.checks['job:ranking']).toBe('fail')
  })

  it('não derruba quando só a consulta do Temporizador falha (o motor já aparece na sonda do motor)', async () => {
    const res = await request(build({ schedulerFails: true }).app).get('/health/ready')
    expect(res.status).toBe(200)
    expect(res.body.checks.market_tick).toBeUndefined()
  })

  it('guarda o resultado por 10 s', async () => {
    const { app, getSystemHealth, clock } = build()
    await request(app).get('/health/ready')
    await request(app).get('/health/ready')
    expect(getSystemHealth.execute).toHaveBeenCalledTimes(1)
    clock.t += 11_000
    await request(app).get('/health/ready')
    expect(getSystemHealth.execute).toHaveBeenCalledTimes(2)
  })
})
