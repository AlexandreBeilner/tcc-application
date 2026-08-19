import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { createAdminPingRouter } from './pingRouter'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const app = express()
  app.use(createAdminPingRouter(authMiddleware))
  return { app, tokenIssuer }
}

describe('GET /admin/ping', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/admin/ping')
    expect(res.status).toBe(401)
  })

  it('retorna 403 para usuário comum', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).get('/admin/ping').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('retorna 200 para admin — role só alcançável via seed manual', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app).get('/admin/ping').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
