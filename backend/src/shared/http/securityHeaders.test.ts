import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { apiSecurityHeaders, JSON_BODY_LIMIT } from './securityHeaders'

function buildApp() {
  const app = express()
  app.use(apiSecurityHeaders())
  app.use(express.json({ limit: JSON_BODY_LIMIT }))
  app.post('/x', (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe('apiSecurityHeaders', () => {
  it('envia os cabeçalhos de segurança de uma API JSON', async () => {
    const res = await request(buildApp()).post('/x').send({})
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none'")
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('libera o uso cross-origin dos recursos (avatares) e deixa o HSTS pro proxy', async () => {
    const res = await request(buildApp()).post('/x').send({})
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin')
    expect(res.headers['strict-transport-security']).toBeUndefined()
  })

  it('recusa corpo JSON acima do limite com 413', async () => {
    const res = await request(buildApp())
      .post('/x')
      .send({ blob: 'a'.repeat(200 * 1024) })
    expect(res.status).toBe(413)
  })
})
