import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'

describe('GET /status', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reporta engine ok quando o motor responde status ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      }),
    )

    const res = await request(createApp()).get('/status')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ backend: 'ok', engine: 'ok' })
  })

  it('reporta engine unreachable quando a chamada falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connection refused')),
    )

    const res = await request(createApp()).get('/status')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ backend: 'ok', engine: 'unreachable' })
  })
})
