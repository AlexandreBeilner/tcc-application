import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { DAILY_RATE_LIMIT, createDailyRateLimiter } from './dailyRateLimit'

describe('limite das rotas do Diário', () => {
  it('conta por IP real atrás do proxy e responde 429 com Retry-After ao passar do teto', async () => {
    const app = express()
    app.set('trust proxy', 1)
    app.use(
      '/daily',
      createDailyRateLimiter(() => 0),
    )
    app.get('/daily/today', (_req, res) => res.json({ ok: true }))

    for (let i = 0; i < DAILY_RATE_LIMIT.max; i++) {
      const ok = await request(app).get('/daily/today').set('X-Forwarded-For', '203.0.113.7')
      expect(ok.status).toBe(200)
    }
    const blocked = await request(app).get('/daily/today').set('X-Forwarded-For', '203.0.113.7')
    expect(blocked.status).toBe(429)
    expect(blocked.headers['retry-after']).toBeDefined()

    // Outro IP real tem o próprio balde.
    const other = await request(app).get('/daily/today').set('X-Forwarded-For', '203.0.113.8')
    expect(other.status).toBe(200)
  })
})
