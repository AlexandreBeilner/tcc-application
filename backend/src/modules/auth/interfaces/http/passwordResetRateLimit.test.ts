import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  createForgotPasswordRateLimiters,
  createResetPasswordRateLimiter,
} from './passwordResetRateLimit'

function buildApp(clock: { t: number }) {
  const app = express()
  app.use(express.json())
  app.use('/auth/forgot-password', ...createForgotPasswordRateLimiters({ now: () => clock.t }))
  app.use('/auth/reset-password', createResetPasswordRateLimiter({ now: () => clock.t }))
  app.post('/auth/forgot-password', (_req, res) => {
    res.status(202).json({})
  })
  app.post('/auth/reset-password', (_req, res) => {
    res.status(200).json({})
  })
  return app
}

describe('limites do esqueci minha senha', () => {
  it('3 pedidos por e-mail em 15 minutos; o 4º vira 429 com Retry-After, em qualquer caixa', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock)
    const ask = (email: string) => request(app).post('/auth/forgot-password').send({ email })

    for (let i = 0; i < 3; i += 1) expect((await ask('ana@exemplo.com')).status).toBe(202)
    const blocked = await ask('ANA@exemplo.com')

    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    // Outro endereço, mesmo IP, ainda passa.
    expect((await ask('bia@exemplo.com')).status).toBe(202)
  })

  it('libera de novo quando a janela vence', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock)
    const ask = () => request(app).post('/auth/forgot-password').send({ email: 'ana@exemplo.com' })
    for (let i = 0; i < 3; i += 1) await ask()
    expect((await ask()).status).toBe(429)

    clock.t = 15 * 60_000 + 1

    expect((await ask()).status).toBe(202)
  })

  it('por IP: 20 pedidos em 15 minutos, mesmo com e-mails diferentes', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock)
    for (let i = 0; i < 20; i += 1) {
      expect(
        (
          await request(app)
            .post('/auth/forgot-password')
            .send({ email: `u${i}@exemplo.com` })
        ).status,
      ).toBe(202)
    }

    const blocked = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'outro@exemplo.com' })

    expect(blocked.status).toBe(429)
  })

  it('reset: 20 tentativas por IP em 15 minutos', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock)
    for (let i = 0; i < 20; i += 1) await request(app).post('/auth/reset-password').send({})

    expect((await request(app).post('/auth/reset-password').send({})).status).toBe(429)
  })
})
