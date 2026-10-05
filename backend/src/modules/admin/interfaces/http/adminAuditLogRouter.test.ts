import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { ListAuditLogUseCase } from '../../application/useCases/listAuditLog'
import {
  createFakeAuditLogRepository,
  type FakeAuditLogRepository,
} from '../../test/fakes/fakeAuditLogRepository'
import { createAdminAuditLogRouter } from './adminAuditLogRouter'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'

function buildApp(auditLog: FakeAuditLogRepository) {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const app = express()
  app.use(express.json())
  app.use(
    createAdminAuditLogRouter({ listAuditLog: new ListAuditLogUseCase(auditLog), authMiddleware }),
  )
  return { app, tokenIssuer }
}

describe('GET /admin/audit-log', () => {
  let auditLog: FakeAuditLogRepository

  beforeEach(async () => {
    auditLog = createFakeAuditLogRepository()
    await auditLog.append({
      adminId: ADMIN_ID,
      action: 'tick.trigger',
      targetType: 'tick',
      targetId: '10',
      payload: { day: 10 },
      result: 'success',
    })
    await auditLog.append({
      adminId: ADMIN_ID,
      action: 'macro_event.trigger',
      targetType: 'macro_event',
      payload: { template_key: 'x' },
      result: 'failed',
      errorMessage: 'template inexistente',
    })
  })

  it('retorna 401 sem token', async () => {
    const { app } = buildApp(auditLog)
    expect((await request(app).get('/admin/audit-log')).status).toBe(401)
  })

  it('retorna 403 para usuário comum', async () => {
    const { app, tokenIssuer } = buildApp(auditLog)
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).get('/admin/audit-log').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('retorna 200 com as entradas serializadas em snake_case, mais recente primeiro', async () => {
    const { app, tokenIssuer } = buildApp(auditLog)
    const token = tokenIssuer.issue({ sub: ADMIN_ID, role: 'admin' })

    const res = await request(app).get('/admin/audit-log').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.total_entries).toBe(2)
    expect(res.body.entries[0]).toEqual({
      id: 'audit-2',
      admin_id: ADMIN_ID,
      admin_username: null,
      action: 'macro_event.trigger',
      target_type: 'macro_event',
      target_id: null,
      payload: { template_key: 'x' },
      result: 'failed',
      error_message: 'template inexistente',
      occurred_at: '2026-10-03T12:00:00.000Z',
    })
  })

  it('aplica os filtros de ação e resultado', async () => {
    const { app, tokenIssuer } = buildApp(auditLog)
    const token = tokenIssuer.issue({ sub: ADMIN_ID, role: 'admin' })

    const res = await request(app)
      .get('/admin/audit-log?action=tick.trigger&result=success')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.total_entries).toBe(1)
    expect(res.body.entries[0].action).toBe('tick.trigger')
  })

  it.each([
    ['ação fora da lista fechada', 'action=usuario.apagar'],
    ['resultado inválido', 'result=talvez'],
    ['admin_id que não é uuid', 'admin_id=abc'],
    ['limit acima do teto', 'limit=101'],
    ['offset negativo', 'offset=-1'],
    ['data inválida', 'from=ontem'],
    ['intervalo invertido', 'from=2026-10-04T00:00:00Z&to=2026-10-03T00:00:00Z'],
  ])('retorna 400 para %s', async (_name, query) => {
    const { app, tokenIssuer } = buildApp(auditLog)
    const token = tokenIssuer.issue({ sub: ADMIN_ID, role: 'admin' })

    const res = await request(app)
      .get(`/admin/audit-log?${query}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })
})
