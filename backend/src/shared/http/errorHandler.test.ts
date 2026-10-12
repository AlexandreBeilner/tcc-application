import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { jsonErrorHandler } from './errorHandler'

function buildApp(throwing: () => unknown) {
  const app = express()
  app.use(express.json())
  app.get('/boom', async () => {
    throw throwing()
  })
  app.post('/echo', (_req, res) => {
    res.status(200).json({ ok: true })
  })
  app.use(jsonErrorHandler)
  return app
}

describe('jsonErrorHandler', () => {
  it('traduz erro de cast do Postgres (embrulhado em cause) pra 400 JSON', async () => {
    const err = new Error('Failed query', {
      cause: Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' }),
    })
    const res = await request(buildApp(() => err)).get('/boom')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'identificador ou valor inválido' })
  })

  it('traduz numeric out of range pra 400', async () => {
    const res = await request(buildApp(() => Object.assign(new Error('x'), { code: '22003' }))).get(
      '/boom',
    )
    expect(res.status).toBe(400)
  })

  it('traduz ProRequiredError (code PRO_REQUIRED) pra 403, nunca 404', async () => {
    const res = await request(
      buildApp(() => Object.assign(new Error('requer plano PRO'), { code: 'PRO_REQUIRED' })),
    ).get('/boom')
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'requer plano PRO' })
  })

  it('devolve 500 JSON (sem HTML) pra erro inesperado', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(buildApp(() => new Error('kaboom'))).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'erro interno' })
    spy.mockRestore()
  })

  it('não confunde outro código do Postgres (23505) com entrada inválida', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(
      buildApp(() => Object.assign(new Error('dup'), { code: '23505' })),
    ).get('/boom')
    expect(res.status).toBe(500)
    spy.mockRestore()
  })

  it('JSON malformado no corpo vira 400 JSON', async () => {
    const res = await request(buildApp(() => new Error('n/a')))
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"a":')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'requisição inválida' })
  })
})
