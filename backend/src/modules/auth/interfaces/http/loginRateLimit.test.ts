import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  authRateLimitDisabled,
  createGoogleTokenRateLimiter,
  createLoginRateLimiters,
  createRegisterRateLimiter,
} from './loginRateLimit'

function buildApp(clock: { t: number }) {
  const app = express()
  app.use(express.json())
  const now = () => clock.t
  app.use('/auth/login', ...createLoginRateLimiters({ now }))
  app.use('/auth/register', createRegisterRateLimiter({ now }))
  app.use('/auth/google/token', createGoogleTokenRateLimiter({ now }))
  app.post('/auth/login', (_req, res) => {
    res.status(401).json({ error: 'credenciais inválidas' })
  })
  app.post('/auth/register', (_req, res) => {
    res.status(201).json({})
  })
  app.post('/auth/google/token', (_req, res) => {
    res.status(200).json({})
  })
  return app
}

describe('limites do login', () => {
  it('10 tentativas por e-mail em 15 minutos; a 11ª vira 429 com Retry-After, em qualquer caixa', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock)
    const attempt = (email: string) =>
      request(app).post('/auth/login').send({ email, password: 'x' })

    for (let i = 0; i < 10; i += 1) expect((await attempt('ana@exemplo.com')).status).toBe(401)
    const blocked = await attempt('  ANA@exemplo.com ')

    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    // Outro e-mail, mesmo IP, ainda passa.
    expect((await attempt('bia@exemplo.com')).status).toBe(401)
  })

  it('o 429 vale também para e-mail que não existe (não revela quem está cadastrado)', async () => {
    const app = buildApp({ t: 0 })
    const attempt = () =>
      request(app).post('/auth/login').send({ email: 'ninguem@exemplo.com', password: 'x' })
    for (let i = 0; i < 10; i += 1) await attempt()
    expect((await attempt()).status).toBe(429)
  })

  it('por IP: 30 tentativas em 15 minutos, mesmo trocando de e-mail a cada vez', async () => {
    const app = buildApp({ t: 0 })
    for (let i = 0; i < 30; i += 1) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: `conta${i}@exemplo.com`, password: 'x' })
      expect(res.status).toBe(401)
    }
    const blocked = await request(app)
      .post('/auth/login')
      .send({ email: 'outra@exemplo.com', password: 'x' })
    expect(blocked.status).toBe(429)
  })

  it('libera de novo quando a janela vence', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock)
    const attempt = () =>
      request(app).post('/auth/login').send({ email: 'ana@exemplo.com', password: 'x' })
    for (let i = 0; i < 10; i += 1) await attempt()
    expect((await attempt()).status).toBe(429)

    clock.t = 15 * 60_000 + 1
    expect((await attempt()).status).toBe(401)
  })

  it('corpo sem e-mail não derruba o limitador: cai no limite por IP e a rota responde', async () => {
    const app = buildApp({ t: 0 })
    const res = await request(app).post('/auth/login').send({})
    expect(res.status).toBe(401)
  })
})

describe('limite do cadastro e do login Google por token', () => {
  it('cadastro: 20 por hora por IP; o 21º vira 429 e libera depois de uma hora', async () => {
    const clock = { t: 0 }
    const app = buildApp(clock)
    for (let i = 0; i < 20; i += 1) {
      expect(
        (
          await request(app)
            .post('/auth/register')
            .send({ email: `u${i}@x.com` })
        ).status,
      ).toBe(201)
    }
    expect((await request(app).post('/auth/register').send({})).status).toBe(429)

    clock.t = 60 * 60_000 + 1
    expect((await request(app).post('/auth/register').send({})).status).toBe(201)
  })

  it('Google por token: 30 em 15 minutos por IP', async () => {
    const app = buildApp({ t: 0 })
    for (let i = 0; i < 30; i += 1) {
      expect((await request(app).post('/auth/google/token').send({})).status).toBe(200)
    }
    expect((await request(app).post('/auth/google/token').send({})).status).toBe(429)
  })
})

describe('AUTH_RATE_LIMIT', () => {
  it('só o valor "off" desliga os limites', () => {
    expect(authRateLimitDisabled({ AUTH_RATE_LIMIT: 'off' })).toBe(true)
    expect(authRateLimitDisabled({ AUTH_RATE_LIMIT: ' off ' })).toBe(true)
    expect(authRateLimitDisabled({})).toBe(false)
    expect(authRateLimitDisabled({ AUTH_RATE_LIMIT: 'false' })).toBe(false)
    expect(authRateLimitDisabled({ AUTH_RATE_LIMIT: 'on' })).toBe(false)
  })
})
