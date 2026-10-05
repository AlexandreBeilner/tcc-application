import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './rateLimit'

function buildApp(clock: { t: number }, max = 2) {
  const app = express()
  app.use(createRateLimiter({ windowMs: 1000, max, now: () => clock.t }))
  app.get('/x', (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe('createRateLimiter', () => {
  it('aceita até o máximo e devolve 429 com Retry-After depois', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock)
    expect((await request(app).get('/x')).status).toBe(200)
    expect((await request(app).get('/x')).status).toBe(200)
    const blocked = await request(app).get('/x')
    expect(blocked.status).toBe(429)
    expect(blocked.headers['retry-after']).toBe('1')
  })

  it('libera de novo quando a janela vence', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock, 1)
    await request(app).get('/x')
    expect((await request(app).get('/x')).status).toBe(429)
    clock.t = 1001
    expect((await request(app).get('/x')).status).toBe(200)
  })
})
