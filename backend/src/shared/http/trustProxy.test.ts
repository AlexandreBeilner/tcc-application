import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './rateLimit'
import { readTrustedProxyHops } from './trustProxy'

describe('readTrustedProxyHops', () => {
  it('usa 1 salto quando a variável está ausente ou vazia', () => {
    expect(readTrustedProxyHops(undefined)).toBe(1)
    expect(readTrustedProxyHops('')).toBe(1)
    expect(readTrustedProxyHops('  ')).toBe(1)
  })

  it('aceita inteiros de 0 a 5', () => {
    expect(readTrustedProxyHops('0')).toBe(0)
    expect(readTrustedProxyHops('2')).toBe(2)
    expect(readTrustedProxyHops('5')).toBe(5)
  })

  it.each(['-1', '6', '1.5', 'abc', 'true'])('recusa "%s"', (raw) => {
    expect(() => readTrustedProxyHops(raw)).toThrow(/TRUSTED_PROXY_HOPS/)
  })
})

describe('limitador de taxa atrás do proxy (1 salto)', () => {
  function buildApp(hops: number) {
    const app = express()
    app.set('trust proxy', hops)
    app.use(createRateLimiter({ windowMs: 60_000, max: 1 }))
    app.get('/x', (_req, res) => {
      res.json({ ok: true })
    })
    return app
  }

  it('conta cada IP real em um balde próprio', async () => {
    const app = buildApp(1)
    expect((await request(app).get('/x').set('X-Forwarded-For', '203.0.113.1')).status).toBe(200)
    expect((await request(app).get('/x').set('X-Forwarded-For', '203.0.113.2')).status).toBe(200)
    expect((await request(app).get('/x').set('X-Forwarded-For', '203.0.113.1')).status).toBe(429)
  })

  it('ignora o IP forjado pelo cliente: só vale o último valor, o que o proxy acrescentou', async () => {
    const app = buildApp(1)
    // O cliente tenta passar por outros IPs a cada pedido; o proxy sempre acrescenta o real.
    const first = await request(app).get('/x').set('X-Forwarded-For', '6.6.6.1, 203.0.113.9')
    const second = await request(app).get('/x').set('X-Forwarded-For', '6.6.6.2, 203.0.113.9')
    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
  })

  it('sem proxy confiável (0 saltos) usa o IP da conexão e ignora o cabeçalho', async () => {
    const app = buildApp(0)
    expect((await request(app).get('/x').set('X-Forwarded-For', '203.0.113.1')).status).toBe(200)
    expect((await request(app).get('/x').set('X-Forwarded-For', '203.0.113.2')).status).toBe(429)
  })
})
