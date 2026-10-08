import express from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { FakeAnnouncementRepository } from '../../../announcements/test/fakes/fakeAnnouncementRepository'
import { createFakeAnnouncementAdmin } from '../../test/fakes/fakeAnnouncementAdmin'
import {
  CreateAdminAnnouncementUseCase,
  EndAdminAnnouncementUseCase,
  ListAdminAnnouncementsUseCase,
  StartMaintenanceUseCase,
  UpdateAdminAnnouncementUseCase,
} from '../../application/useCases/announcements'
import { LiftTradingHaltUseCase } from '../../application/useCases/liftTradingHalt'
import { PauseTradingUseCase } from '../../application/useCases/pauseTrading'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { TradingHaltConflictError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeTradingHaltAdmin, sampleHalt } from '../../test/fakes/fakeTradingHaltAdmin'
import { createAdminAnnouncementsRouter } from './adminAnnouncementsRouter'

const NOW = new Date('2026-10-06T12:00:00Z')
const clock = () => NOW
const UNKNOWN_ID = '9d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a99'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const repository = new FakeAnnouncementRepository()
  const tradingHaltAdmin = createFakeTradingHaltAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const announcementAdmin = createFakeAnnouncementAdmin(repository, clock)

  const pauseTrading = new PauseTradingUseCase(tradingHaltAdmin, record)
  const liftTradingHalt = new LiftTradingHaltUseCase(tradingHaltAdmin, record)
  const app = express()
  app.use(express.json())
  app.use(
    createAdminAnnouncementsRouter({
      listAnnouncements: new ListAdminAnnouncementsUseCase(announcementAdmin),
      createAnnouncement: new CreateAdminAnnouncementUseCase(announcementAdmin, record),
      updateAnnouncement: new UpdateAdminAnnouncementUseCase(announcementAdmin, record),
      endAnnouncement: new EndAdminAnnouncementUseCase(announcementAdmin, liftTradingHalt, record),
      startMaintenance: new StartMaintenanceUseCase(
        announcementAdmin,
        pauseTrading,
        liftTradingHalt,
        record,
        clock,
      ),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, repository, tradingHaltAdmin, auditLog, adminToken, userToken }
}

const notice = {
  title: 'Evento extraordinário',
  body: 'Vamos avançar 5 dias do mercado.',
  severity: 'warning',
  starts_at: '2026-10-06T11:00:00Z',
  ends_at: '2026-10-06T13:00:00Z',
}

describe('rotas admin de comunicados (N.20)', () => {
  // O início padrão ("agora") vem do relógio real do router; fixa o mesmo instante do resto.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const routes: Array<[string, 'get' | 'post' | 'patch', string, object?]> = [
    ['GET /admin/announcements', 'get', '/admin/announcements'],
    ['POST /admin/announcements', 'post', '/admin/announcements', notice],
    [
      'PATCH /admin/announcements/:id',
      'patch',
      `/admin/announcements/${UNKNOWN_ID}`,
      { title: 'x' },
    ],
    ['POST /admin/announcements/:id/end', 'post', `/admin/announcements/${UNKNOWN_ID}/end`],
    ['POST /admin/maintenance', 'post', '/admin/maintenance', { title: 't', body: 'b' }],
  ]

  it.each(routes)('%s retorna 401 sem token', async (_n, method, path, body) => {
    const { app } = buildApp()
    expect((await request(app)[method](path).send(body)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum, sem auditar',
    async (_n, method, path, body) => {
      const { app, userToken, auditLog, repository } = buildApp()
      const res = await request(app)[method](path).set('Authorization', userToken()).send(body)
      expect(res.status).toBe(403)
      expect(auditLog.entries).toHaveLength(0)
      expect(repository.items).toHaveLength(0)
    },
  )

  it('cria um comunicado, lista com o estado e audita', async () => {
    const { app, adminToken, auditLog } = buildApp()
    const created = await request(app)
      .post('/admin/announcements')
      .set('Authorization', adminToken())
      .send(notice)
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      title: notice.title,
      kind: 'notice',
      status: 'active',
      dismissible: true,
    })

    const listed = await request(app).get('/admin/announcements').set('Authorization', adminToken())
    expect(listed.body.announcements).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      action: 'announcement.create',
      targetId: created.body.id,
      result: 'success',
    })
  })

  it('sem início usa agora e sem fim fica até encerrar', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app)
      .post('/admin/announcements')
      .set('Authorization', adminToken())
      .send({ title: 't', body: 'b', severity: 'info' })
    expect(res.status).toBe(201)
    expect(res.body.ends_at).toBeNull()
    expect(res.body.status).toBe('active')
  })

  it.each([
    ['HTML no texto', { ...notice, body: '<b>oi</b>' }],
    ['título acima de 80', { ...notice, title: 'a'.repeat(81) }],
    ['fim antes do início', { ...notice, ends_at: '2026-10-06T10:00:00Z' }],
  ])('recusa %s com 422 e audita a falha', async (_label, body) => {
    const { app, adminToken, auditLog } = buildApp()
    const res = await request(app)
      .post('/admin/announcements')
      .set('Authorization', adminToken())
      .send(body)
    expect(res.status).toBe(422)
    expect(auditLog.entries[0]).toMatchObject({ action: 'announcement.create', result: 'failed' })
  })

  it('severidade fora da lista e data malformada devolvem 400', async () => {
    const { app, adminToken } = buildApp()
    const post = (body: object) =>
      request(app).post('/admin/announcements').set('Authorization', adminToken()).send(body)
    expect((await post({ ...notice, severity: 'fatal' })).status).toBe(400)
    expect((await post({ ...notice, starts_at: 'ontem' })).status).toBe(400)
  })

  it('edita só o que veio; PATCH vazio é 400; inexistente é 404', async () => {
    const { app, adminToken } = buildApp()
    const created = await request(app)
      .post('/admin/announcements')
      .set('Authorization', adminToken())
      .send(notice)
    const patch = (id: string, body: object) =>
      request(app).patch(`/admin/announcements/${id}`).set('Authorization', adminToken()).send(body)

    const edited = await patch(created.body.id, { title: 'Novo título', ends_at: null })
    expect(edited.status).toBe(200)
    expect(edited.body).toMatchObject({ title: 'Novo título', body: notice.body, ends_at: null })
    expect((await patch(created.body.id, {})).status).toBe(400)
    expect((await patch(UNKNOWN_ID, { title: 'x' })).status).toBe(404)
  })

  it('encerrar tira do ar; encerrar de novo é 409', async () => {
    const { app, adminToken, auditLog } = buildApp()
    const created = await request(app)
      .post('/admin/announcements')
      .set('Authorization', adminToken())
      .send(notice)
    const end = () =>
      request(app)
        .post(`/admin/announcements/${created.body.id}/end`)
        .set('Authorization', adminToken())

    const first = await end()
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ outcome: 'ended', halt_lifted: false })
    // `announcement` é o estado de antes de encerrar; o de depois está na listagem.
    const listed = await request(app).get('/admin/announcements').set('Authorization', adminToken())
    expect(listed.body.announcements[0].status).toBe('ended')
    expect(auditLog.entries.at(-1)).toMatchObject({
      action: 'announcement.end',
      payload: { kind: 'notice', outcome: 'ended', halt_lifted: false },
    })
    expect((await end()).status).toBe(409)
  })
})

describe('modo de manutenção (N.20)', () => {
  it('sem pausa: abre o aviso crítico e não dispensável, sem pedir senha recente e sem tocar no motor', async () => {
    const { app, adminToken, tradingHaltAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post('/admin/maintenance')
      .set('Authorization', adminToken())
      .send({ title: 'Manutenção às 22h', body: 'Voltamos logo.', ends_at: '2026-10-06T14:00:00Z' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      kind: 'maintenance',
      severity: 'critical',
      dismissible: false,
      linked_halt_id: null,
      status: 'active',
    })
    expect(tradingHaltAdmin.calls).toHaveLength(0)
    expect(auditLog.entries[0]).toMatchObject({ action: 'maintenance.start', result: 'success' })
  })

  it('com pausa: exige senha recente (401 reauth_required) e não grava nada', async () => {
    const { app, auditLog, repository, tradingHaltAdmin } = buildApp()
    const res = await request(app)
      .post('/admin/maintenance')
      .set('Authorization', 'Bearer fake-token:admin-1:admin:1000')
      .send({ title: 't', body: 'b', pause_trading: true })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'reauth_required' })
    expect(repository.items).toHaveLength(0)
    expect(tradingHaltAdmin.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it('com pausa: abre a pausa global, liga ao aviso e encerrar levanta a pausa', async () => {
    const { app, adminToken, tradingHaltAdmin, auditLog } = buildApp()
    const started = await request(app)
      .post('/admin/maintenance')
      .set('Authorization', adminToken())
      .send({
        title: 'Janela de manutenção',
        body: 'Sem negociação por um tempo.',
        pause_trading: true,
      })

    expect(started.status).toBe(201)
    expect(tradingHaltAdmin.paused[0]?.input).toMatchObject({ scope: 'global' })
    expect(started.body.linked_halt_id).toBe(sampleHalt.id)
    expect(auditLog.entries.map((e) => e.action)).toEqual(['trading.halt', 'maintenance.start'])

    const ended = await request(app)
      .post(`/admin/announcements/${started.body.id}/end`)
      .set('Authorization', adminToken())
    expect(ended.status).toBe(200)
    expect(ended.body.halt_lifted).toBe(true)
    expect(tradingHaltAdmin.lifted).toEqual([{ haltId: sampleHalt.id, adminId: 'admin-1' }])
  })

  it('encerrar com a pausa já levantada à mão não é erro', async () => {
    const { app, adminToken, tradingHaltAdmin } = buildApp()
    const started = await request(app)
      .post('/admin/maintenance')
      .set('Authorization', adminToken())
      .send({ title: 't', body: 'b', pause_trading: true })
    tradingHaltAdmin.errorToThrow = new TradingHaltConflictError('a pausa já foi encerrada')

    const ended = await request(app)
      .post(`/admin/announcements/${started.body.id}/end`)
      .set('Authorization', adminToken())
    expect(ended.status).toBe(200)
    expect(ended.body.halt_lifted).toBe(false)
  })

  it('segunda manutenção em aberto devolve 409 e levanta a pausa que acabara de abrir', async () => {
    const { app, adminToken, tradingHaltAdmin } = buildApp()
    const start = (body: object) =>
      request(app).post('/admin/maintenance').set('Authorization', adminToken()).send(body)
    expect((await start({ title: 't', body: 'b' })).status).toBe(201)

    const second = await start({ title: 't2', body: 'b2', pause_trading: true })
    expect(second.status).toBe(409)
    expect(tradingHaltAdmin.paused).toHaveLength(1)
    expect(tradingHaltAdmin.lifted).toHaveLength(1)
  })

  it('pausa com início agendado é recusada (422): a pausa valeria antes do aviso', async () => {
    const { app, adminToken, tradingHaltAdmin } = buildApp()
    const res = await request(app)
      .post('/admin/maintenance')
      .set('Authorization', adminToken())
      .send({ title: 't', body: 'b', pause_trading: true, starts_at: '2026-10-07T00:00:00Z' })
    expect(res.status).toBe(422)
    expect(tradingHaltAdmin.calls).toHaveLength(0)
  })

  it('aviso de manutenção não se edita (409)', async () => {
    const { app, adminToken } = buildApp()
    const started = await request(app)
      .post('/admin/maintenance')
      .set('Authorization', adminToken())
      .send({ title: 't', body: 'b' })
    const res = await request(app)
      .patch(`/admin/announcements/${started.body.id}`)
      .set('Authorization', adminToken())
      .send({ title: 'outro' })
    expect(res.status).toBe(409)
  })
})
