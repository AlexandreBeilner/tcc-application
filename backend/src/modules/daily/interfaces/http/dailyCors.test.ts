import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApiCors, isPublicDailyPath } from './dailyCors'

const APP = 'https://app.selucra.com.br'
const LANDING = 'https://selucra.com.br'

function app() {
  const server = express()
  server.use(createApiCors({ appOrigin: APP, landingOrigin: LANDING }))
  server.use((_req, res) => res.json({ ok: true }))
  return server
}

describe('isPublicDailyPath', () => {
  it.each([
    '/daily/today',
    '/daily/metrics',
    '/daily/12',
    '/daily/12/word/guess',
    '/daily/12/cards/trivia/answer',
    '/daily/12/cards/timeline/answer',
  ])('%s é pública', (path) => expect(isPublicDailyPath(path)).toBe(true))

  it.each([
    '/daily/12/me',
    '/daily/me/stats',
    '/daily',
    '/daily/',
    '/daily/12/word/guess/x',
    '/auth/login',
    '/me',
    '/dailyx/today',
  ])('%s não é pública', (path) => expect(isPublicDailyPath(path)).toBe(false))
})

describe('CORS da API', () => {
  it('as rotas públicas do Diário aceitam a origem da landing, sem credenciais', async () => {
    const res = await request(app()).get('/daily/today').set('Origin', LANDING)
    expect(res.headers['access-control-allow-origin']).toBe(LANDING)
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('o preflight de um POST público da landing é aceito', async () => {
    const res = await request(app())
      .options('/daily/3/word/guess')
      .set('Origin', LANDING)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(LANDING)
  })

  it('as rotas públicas continuam aceitando a origem do app', async () => {
    const res = await request(app()).get('/daily/today').set('Origin', APP)
    expect(res.headers['access-control-allow-origin']).toBe(APP)
  })

  it('o resto da API recusa a origem da landing', async () => {
    for (const path of ['/me', '/auth/login', '/daily/3/me', '/daily/me/stats', '/missions']) {
      const res = await request(app()).get(path).set('Origin', LANDING)
      // O navegador só libera se o cabeçalho for igual à origem da página: a da landing não é.
      expect(res.headers['access-control-allow-origin']).toBe(APP)
    }
  })

  it('o resto da API segue aceitando a origem do app', async () => {
    const res = await request(app()).get('/me').set('Origin', APP)
    expect(res.headers['access-control-allow-origin']).toBe(APP)
  })

  it('outra origem qualquer não é aceita nem nas rotas públicas', async () => {
    const res = await request(app()).get('/daily/today').set('Origin', 'https://evil.example')
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example')
  })
})
