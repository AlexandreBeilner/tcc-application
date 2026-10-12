import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestLogger, sanitizePath } from './requestLogger'

function buildApp() {
  const app = express()
  app.use(requestLogger())
  app.get('/health', (_req, res) => res.json({ ok: true }))
  app.get('/users/:id/posts', (_req, res) => res.json({ ok: true }))
  app.get('/boom', (_req, res) => res.status(500).json({ error: 'x' }))
  return app
}

afterEach(() => vi.restoreAllMocks())

describe('requestLogger', () => {
  it('loga método, caminho sem ids e query, status e duração, e devolve X-Request-Id', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await request(buildApp()).get(
      '/users/2c7e9b52-1f4a-4c1b-9d3e-0a1b2c3d4e5f/posts?token=segredo',
    )
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(log).toHaveBeenCalledTimes(1)
    const [msg, entry] = log.mock.calls[0]
    expect(msg).toBe('requisição')
    expect(entry).toMatchObject({
      method: 'GET',
      path: '/users/:id/posts',
      status: 200,
      requestId: res.headers['x-request-id'],
    })
    expect(typeof entry.ms).toBe('number')
    expect(JSON.stringify(entry)).not.toContain('segredo')
  })

  it('respeita um X-Request-Id válido e troca um malformado', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await request(buildApp()).get('/boom').set('X-Request-Id', 'abc-12345678')
    expect(ok.headers['x-request-id']).toBe('abc-12345678')
    const bad = await request(buildApp()).get('/boom').set('X-Request-Id', 'x y\tz')
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('usa nível de erro para 5xx e ignora os healthchecks', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await request(buildApp()).get('/health')
    await request(buildApp()).get('/boom')
    expect(log).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      'requisição falhou',
      expect.objectContaining({ status: 500 }),
    )
  })
})

describe('sanitizePath', () => {
  it('troca ids numéricos e UUID e tira a query', () => {
    expect(sanitizePath('/a/12/b/34?x=1')).toBe('/a/:id/b/:id')
    expect(sanitizePath('/duels/2c7e9b52-1f4a-4c1b-9d3e-0a1b2c3d4e5f')).toBe('/duels/:id')
    expect(sanitizePath('/ranking')).toBe('/ranking')
  })
})
