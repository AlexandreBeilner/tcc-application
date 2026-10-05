import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { TickInProgressError } from '../../domain/errors'
import { TriggerTickUseCase } from '../../application/useCases/triggerTick'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeTickTrigger } from '../../test/fakes/fakeTickTrigger'
import { createAdminTickRouter } from './adminTickRouter'

const sampleResult = {
  day: 10,
  selic_rate: 10.75,
  quotes_count: 24,
  fundamentals_count: 0,
  is_copom_day: false,
  is_report_day: false,
  dividends_generated_count: 0,
  dividends_paid_count: 0,
  bot_fills_count: 3,
  expired_orders_count: 0,
  uncovered_assets_count: 0,
  intraday_rounds_count: 2,
}

function buildApp(tickTrigger = createFakeTickTrigger(sampleResult)) {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const auditLog = createFakeAuditLogRepository()
  const triggerTick = new TriggerTickUseCase(tickTrigger, new RecordAdminActionUseCase(auditLog))
  const app = express()
  app.use(express.json())
  app.use(createAdminTickRouter({ triggerTick, authMiddleware }))
  return { app, tokenIssuer, tickTrigger, auditLog }
}

describe('POST /admin/tick', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).post('/admin/tick')
    expect(res.status).toBe(401)
  })

  it('retorna 403 para usuário comum', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).post('/admin/tick').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('retorna 200 para admin com o resultado do tick', async () => {
    const { app, tokenIssuer, tickTrigger } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app).post('/admin/tick').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(sampleResult)
    expect(tickTrigger.calls).toBe(1)
  })

  it('registra no log de auditoria quem disparou o tick', async () => {
    const { app, tokenIssuer, auditLog } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    await request(app).post('/admin/tick').set('Authorization', `Bearer ${token}`)

    expect(auditLog.entries).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'tick.trigger',
      result: 'success',
    })
  })

  it('não grava auditoria quando o acesso é negado (403)', async () => {
    const { app, tokenIssuer, auditLog } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    await request(app).post('/admin/tick').set('Authorization', `Bearer ${token}`)

    expect(auditLog.entries).toHaveLength(0)
  })

  it('retorna 409 quando o motor já tem um tick em andamento', async () => {
    const tickTrigger = createFakeTickTrigger(sampleResult)
    tickTrigger.errorToThrow = new TickInProgressError('já existe um tick em andamento')
    const { app, tokenIssuer, auditLog } = buildApp(tickTrigger)
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app).post('/admin/tick').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('já existe um tick em andamento')
    expect(auditLog.entries[0]).toMatchObject({
      result: 'failed',
      errorMessage: 'já existe um tick em andamento',
    })
  })
})

// N.22: ação destrutiva exige senha conferida há pouco (`authTime` recente).
describe('reautenticação em ações destrutivas', () => {
  it('POST /admin/tick devolve 401 reauth_required com authTime antigo', async () => {
    const { app, auditLog } = buildApp()
    const staleToken = 'fake-token:admin-1:admin:1000'

    const res = await request(app)
      .post('/admin/tick')
      .set('Authorization', `Bearer ${staleToken}`)
      .send({})

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'reauth_required' })
    expect((await auditLog.list({ limit: 10, offset: 0 })).entries).toHaveLength(0)
  })
})
