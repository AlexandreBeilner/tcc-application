import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { ExportCsvUseCase } from '../../application/useCases/exportCsv'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeExportSource } from '../../test/fakes/fakeExportSource'
import { createAdminExportsRouter } from './adminExportsRouter'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const sources = {
    users: createFakeExportSource(),
    orders: createFakeExportSource({ columns: ['id'], rows: [['o1']], truncated: true }),
    'market-events': createFakeExportSource(),
    'audit-log': createFakeExportSource(),
  }
  const auditLog = createFakeAuditLogRepository()
  const app = express()
  app.use(
    createAdminExportsRouter({
      exportCsv: new ExportCsvUseCase(
        sources,
        new RecordAdminActionUseCase(auditLog),
        () => new Date('2026-10-06T15:00:00Z'),
      ),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, sources, auditLog, adminToken, userToken }
}

describe('GET /admin/exports/:dataset (N.21)', () => {
  it('retorna 401 sem token e 403 para usuário comum, sem ler nem auditar', async () => {
    const { app, userToken, sources, auditLog } = buildApp()
    expect((await request(app).get('/admin/exports/orders')).status).toBe(401)
    expect(
      (await request(app).get('/admin/exports/orders').set('Authorization', userToken())).status,
    ).toBe(403)
    expect(sources.orders.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it('devolve o CSV como anexo, com contagem e truncamento nos cabeçalhos, e audita', async () => {
    const { app, adminToken, auditLog } = buildApp()
    const res = await request(app).get('/admin/exports/orders').set('Authorization', adminToken())

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toBe('attachment; filename="orders-20261006.csv"')
    expect(res.headers['x-export-rows']).toBe('1')
    expect(res.headers['x-export-truncated']).toBe('true')
    expect(res.text).toBe('﻿id\r\no1\r\n')
    expect(auditLog.entries[0]).toMatchObject({
      action: 'export.csv',
      targetId: 'orders',
      result: 'success',
    })
  })

  it('período e limite chegam à fonte', async () => {
    const { app, adminToken, sources } = buildApp()
    await request(app)
      .get(
        '/admin/exports/market-events?from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z&limit=25',
      )
      .set('Authorization', adminToken())
    expect(sources['market-events'].calls[0]).toEqual({
      range: { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-02T00:00:00Z') },
      limit: 25,
    })
  })

  it.each([
    ['conjunto desconhecido', '/admin/exports/senhas'],
    ['data malformada', '/admin/exports/orders?from=ontem'],
    [
      'intervalo invertido',
      '/admin/exports/orders?from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z',
    ],
    ['limite zero', '/admin/exports/orders?limit=0'],
  ])('%s devolve 400 sem ler nem auditar', async (_label, path) => {
    const { app, adminToken, sources, auditLog } = buildApp()
    const res = await request(app).get(path).set('Authorization', adminToken())
    expect(res.status).toBe(400)
    expect(sources.orders.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it('usuários (com e-mail) exigem senha recente: 401 reauth_required antes de ler ou auditar', async () => {
    const { app, sources, auditLog } = buildApp()
    const res = await request(app)
      .get('/admin/exports/users')
      .set('Authorization', 'Bearer fake-token:admin-1:admin:1000')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'reauth_required' })
    expect(sources.users.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it('usuários com senha recente exporta normalmente; os outros conjuntos não pedem senha recente', async () => {
    const { app, adminToken } = buildApp()
    expect(
      (await request(app).get('/admin/exports/users').set('Authorization', adminToken())).status,
    ).toBe(200)
    const stale = 'Bearer fake-token:admin-1:admin:1000'
    expect(
      (await request(app).get('/admin/exports/audit-log').set('Authorization', stale)).status,
    ).toBe(200)
  })
})
