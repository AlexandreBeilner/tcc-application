import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import {
  SchedulerDisabledError,
  TickAdvanceFailedError,
  TickInProgressError,
} from '../../domain/errors'
import { AdvanceTicksUseCase } from '../../application/useCases/advanceTicks'
import { GetSchedulerStatusUseCase } from '../../application/useCases/getSchedulerStatus'
import { ListTicksUseCase } from '../../application/useCases/listTicks'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { SetSchedulerPausedUseCase } from '../../application/useCases/setSchedulerPaused'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeSchedulerAdmin, sampleStatus } from '../../test/fakes/fakeSchedulerAdmin'
import { createAdminSchedulerRouter } from './adminSchedulerRouter'

const sampleTick = {
  simulated_day: 12,
  trigger: 'manual' as const,
  status: 'success' as const,
  error_message: null,
  started_at: '2026-10-03T12:00:00Z',
  duration_ms: 1500,
  catch_up_discarded: 0,
  selic_rate: 10.5,
  is_copom_day: false,
  is_report_day: false,
  quotes_count: 24,
  fundamentals_count: 0,
  dividends_generated_count: 0,
  dividends_paid_count: 0,
  bot_fills_count: 3,
  expired_orders_count: 0,
  uncovered_assets_count: 0,
  intraday_rounds_count: 2,
}

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const schedulerAdmin = createFakeSchedulerAdmin({ ticks: [sampleTick], total_entries: 1 })
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const app = express()
  app.use(express.json())
  app.use(
    createAdminSchedulerRouter({
      getSchedulerStatus: new GetSchedulerStatusUseCase(schedulerAdmin),
      setSchedulerPaused: new SetSchedulerPausedUseCase(schedulerAdmin, record),
      listTicks: new ListTicksUseCase(schedulerAdmin),
      advanceTicks: new AdvanceTicksUseCase(schedulerAdmin, record),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, schedulerAdmin, auditLog, adminToken, userToken }
}

const routes: Array<[string, 'get' | 'post', string, object?]> = [
  ['GET /admin/scheduler', 'get', '/admin/scheduler'],
  ['POST /admin/scheduler/pause', 'post', '/admin/scheduler/pause'],
  ['POST /admin/scheduler/resume', 'post', '/admin/scheduler/resume'],
  ['GET /admin/ticks', 'get', '/admin/ticks'],
  ['POST /admin/tick/advance', 'post', '/admin/tick/advance', { days: 2 }],
]

describe('rotas admin do Temporizador (N.6)', () => {
  it.each(routes)('%s retorna 401 sem token', async (_n, method, path, body) => {
    const { app } = buildApp()
    expect((await request(app)[method](path).send(body)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum e não grava auditoria',
    async (_n, method, path, body) => {
      const { app, userToken, auditLog, schedulerAdmin } = buildApp()
      const res = await request(app)[method](path).set('Authorization', userToken()).send(body)
      expect(res.status).toBe(403)
      expect(auditLog.entries).toHaveLength(0)
      expect(schedulerAdmin.calls).toHaveLength(0)
    },
  )

  it('GET /admin/scheduler devolve o estado da agenda', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/scheduler').set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body).toEqual(sampleStatus)
  })

  it('POST /admin/scheduler/pause pausa, devolve o estado e audita quem pausou', async () => {
    const { app, adminToken, auditLog } = buildApp()
    const res = await request(app).post('/admin/scheduler/pause').set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body.paused).toBe(true)
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'scheduler.pause',
      result: 'success',
    })
  })

  it('POST /admin/scheduler/resume retoma e audita', async () => {
    const { app, adminToken, auditLog } = buildApp()
    const res = await request(app)
      .post('/admin/scheduler/resume')
      .set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body.paused).toBe(false)
    expect(auditLog.entries[0]).toMatchObject({ action: 'scheduler.resume' })
  })

  it('pause com a agenda desligada no ambiente devolve 409 e audita a falha', async () => {
    const { app, adminToken, schedulerAdmin, auditLog } = buildApp()
    schedulerAdmin.errorToThrow = new SchedulerDisabledError(
      'a agenda automática está desligada neste ambiente',
    )
    const res = await request(app).post('/admin/scheduler/pause').set('Authorization', adminToken())
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('a agenda automática está desligada neste ambiente')
    expect(auditLog.entries[0]).toMatchObject({ result: 'failed' })
  })

  it('GET /admin/ticks repassa limit/offset e devolve o histórico', async () => {
    const { app, adminToken, schedulerAdmin } = buildApp()
    const res = await request(app)
      .get('/admin/ticks?limit=5&offset=10')
      .set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ticks: [sampleTick], total_entries: 1 })
    expect(schedulerAdmin.listQueries).toEqual([{ limit: 5, offset: 10 }])
  })

  it.each(['limit=0', 'limit=101', 'limit=abc', 'offset=-1'])(
    'GET /admin/ticks?%s retorna 400',
    async (query) => {
      const { app, adminToken } = buildApp()
      const res = await request(app).get(`/admin/ticks?${query}`).set('Authorization', adminToken())
      expect(res.status).toBe(400)
    },
  )

  it('POST /admin/tick/advance avança N dias e devolve os ticks', async () => {
    const { app, adminToken, schedulerAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post('/admin/tick/advance')
      .set('Authorization', adminToken())
      .send({ days: 3 })
    expect(res.status).toBe(200)
    expect(res.body.requested).toBe(3)
    expect(schedulerAdmin.calls).toEqual(['advance:3'])
    expect(auditLog.entries[0]).toMatchObject({
      action: 'tick.advance',
      payload: expect.objectContaining({ days: 3 }),
    })
  })

  it.each([
    ['zero', { days: 0 }],
    ['negativo', { days: -1 }],
    ['acima do teto', { days: 31 }],
    ['fracionário', { days: 1.5 }],
    ['texto', { days: '2' }],
    ['ausente', {}],
  ])(
    'POST /admin/tick/advance recusa days %s com 400 sem chamar o motor nem auditar',
    async (_n, body) => {
      const { app, adminToken, schedulerAdmin, auditLog } = buildApp()
      const res = await request(app)
        .post('/admin/tick/advance')
        .set('Authorization', adminToken())
        .send(body)
      expect(res.status).toBe(400)
      expect(schedulerAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('POST /admin/tick/advance com tick em andamento devolve 409', async () => {
    const { app, adminToken, schedulerAdmin } = buildApp()
    schedulerAdmin.errorToThrow = new TickInProgressError('já existe um tick em andamento')
    const res = await request(app)
      .post('/admin/tick/advance')
      .set('Authorization', adminToken())
      .send({ days: 2 })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('já existe um tick em andamento')
  })

  it('POST /admin/tick/advance com falha no meio devolve 500 com os ticks que já rodaram', async () => {
    const { app, adminToken, schedulerAdmin, auditLog } = buildApp()
    schedulerAdmin.errorToThrow = new TickAdvanceFailedError('falha ao avançar 5 dia(s)', [
      { day: 7 },
    ])
    const res = await request(app)
      .post('/admin/tick/advance')
      .set('Authorization', adminToken())
      .send({ days: 5 })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'falha ao avançar 5 dia(s)', completed_ticks: [{ day: 7 }] })
    expect(auditLog.entries[0]).toMatchObject({ result: 'failed' })
  })
})

// N.22: ação destrutiva exige senha conferida há pouco (`authTime` recente).
describe('reautenticação em ações destrutivas', () => {
  it('POST /admin/scheduler/pause devolve 401 reauth_required com authTime antigo', async () => {
    const { app, auditLog } = buildApp()
    const staleToken = 'fake-token:admin-1:admin:1000'

    const res = await request(app)
      .post('/admin/scheduler/pause')
      .set('Authorization', `Bearer ${staleToken}`)
      .send({})

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'reauth_required' })
    expect((await auditLog.list({ limit: 10, offset: 0 })).entries).toHaveLength(0)
  })

  it('POST /admin/tick/advance devolve 401 reauth_required com authTime antigo', async () => {
    const { app, auditLog } = buildApp()
    const staleToken = 'fake-token:admin-1:admin:1000'

    const res = await request(app)
      .post('/admin/tick/advance')
      .set('Authorization', `Bearer ${staleToken}`)
      .send({})

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'reauth_required' })
    expect((await auditLog.list({ limit: 10, offset: 0 })).entries).toHaveLength(0)
  })
})
