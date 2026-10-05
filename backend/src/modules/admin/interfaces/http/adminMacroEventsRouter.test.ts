import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import {
  InvalidMacroEventError,
  MacroEventConflictError,
  MacroEventNotFoundError,
} from '../../domain/errors'
import { TriggerMacroEventUseCase } from '../../application/useCases/triggerMacroEvent'
import { ListMacroEventsUseCase } from '../../application/useCases/listMacroEvents'
import { CancelMacroEventUseCase } from '../../application/useCases/cancelMacroEvent'
import { GetMacroEventDetailUseCase } from '../../application/useCases/getMacroEventDetail'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeMacroEventTrigger } from '../../test/fakes/fakeMacroEventTrigger'
import { createFakeMacroEventReader } from '../../test/fakes/fakeMacroEventReader'
import {
  createFakeMacroEventAdmin,
  fakeUserViewProjector,
} from '../../test/fakes/fakeMacroEventAdmin'
import { createAdminMacroEventsRouter } from './adminMacroEventsRouter'

const sampleResult = {
  id: 'event-1',
  template_key: 'legislacao-ambiental-mineracao',
  title: 'título',
  narrative: 'narrativa',
  direction: 'negativo',
  magnitude_band: 'moderado',
  affects_price: true,
  affects_fundamentals: true,
  status: 'pendente',
  triggered_on_day: 10,
  duration_days: 2,
  price_effect_pct: -10,
  fundamentals_effect_pct: -12,
  fundamentals_report_day: 14,
  targets: [{ sector: 'Mineração' }],
  created_at: '2026-08-30T14:05:00.000Z',
}

const validTemplateBody = {
  template_key: 'legislacao-ambiental-mineracao',
  targets: [{ sector: 'Mineração' }],
}

function buildApp(
  macroEventTrigger = createFakeMacroEventTrigger(sampleResult),
  macroEventReader = createFakeMacroEventReader({ events: [sampleResult], total_entries: 1 }),
) {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const auditLog = createFakeAuditLogRepository()
  const triggerMacroEvent = new TriggerMacroEventUseCase(
    macroEventTrigger,
    new RecordAdminActionUseCase(auditLog),
  )
  const listMacroEvents = new ListMacroEventsUseCase(macroEventReader)
  const macroEventAdmin = createFakeMacroEventAdmin()
  const getMacroEventDetail = new GetMacroEventDetailUseCase(macroEventAdmin, fakeUserViewProjector)
  const cancelMacroEvent = new CancelMacroEventUseCase(
    macroEventAdmin,
    new RecordAdminActionUseCase(auditLog),
  )
  const app = express()
  app.use(express.json())
  app.use(
    createAdminMacroEventsRouter({
      triggerMacroEvent,
      listMacroEvents,
      getMacroEventDetail,
      cancelMacroEvent,
      authMiddleware,
    }),
  )
  return { app, tokenIssuer, macroEventTrigger, macroEventReader, macroEventAdmin, auditLog }
}

describe('POST /admin/macro-events', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).post('/admin/macro-events').send(validTemplateBody)
    expect(res.status).toBe(401)
  })

  it('retorna 403 para usuário comum', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send(validTemplateBody)
    expect(res.status).toBe(403)
  })

  it('retorna 201 para admin com evento a partir de template', async () => {
    const { app, tokenIssuer, macroEventTrigger } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send(validTemplateBody)

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ event: sampleResult })
    expect(macroEventTrigger.calls).toEqual([validTemplateBody])
  })

  it('audita o disparo com o id do admin e do evento criado', async () => {
    const { app, tokenIssuer, auditLog } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-7', role: 'admin' })

    await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send(validTemplateBody)

    expect(auditLog.entries).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-7',
      action: 'macro_event.trigger',
      targetId: 'event-1',
      result: 'success',
    })
  })

  it('não audita payload recusado pelo Zod (400 antes de chegar ao caso de uso)', async () => {
    const { app, tokenIssuer, auditLog } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send({ foo: 'bar' })

    expect(auditLog.entries).toHaveLength(0)
  })

  it('retorna 201 para admin com evento avulso', async () => {
    const { app, tokenIssuer, macroEventTrigger } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const adHocBody = {
      title: 'título avulso',
      narrative: 'narrativa avulsa',
      direction: 'negativo' as const,
      magnitude_band: 'leve' as const,
      affects_price: true,
      affects_fundamentals: false,
      targets: [{ asset_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }],
    }

    const res = await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send(adHocBody)

    expect(res.status).toBe(201)
    expect(macroEventTrigger.calls).toEqual([adHocBody])
  })

  it('retorna 400 quando o evento avulso não tem um campo obrigatório (ex: sem magnitude_band)', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const incompleteBody = {
      title: 'título',
      narrative: 'narrativa',
      direction: 'negativo',
      // magnitude_band ausente
      affects_price: true,
      affects_fundamentals: false,
      targets: [{ sector: 'Mineração' }],
    }

    const res = await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send(incompleteBody)

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o alvo tem escopo ambíguo (dois entre sector/risk_class/asset_id)', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send({ template_key: 'x', targets: [{ sector: 'Mineração', risk_class: 'Conservador' }] })

    expect(res.status).toBe(400)
  })

  it('retorna 400 quando o motor rejeita o evento (InvalidMacroEventError)', async () => {
    const macroEventTrigger = createFakeMacroEventTrigger(sampleResult)
    macroEventTrigger.errorToThrow = new InvalidMacroEventError(
      'template de evento macro desconhecido',
    )
    const { app, tokenIssuer } = buildApp(macroEventTrigger)
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send(validTemplateBody)

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('template de evento macro desconhecido')
  })
})

describe('GET /admin/macro-events', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/admin/macro-events')
    expect(res.status).toBe(401)
  })

  it('retorna 403 para usuário comum', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('retorna 200 para admin com o histórico de eventos', async () => {
    const { app, tokenIssuer, macroEventReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .get('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ events: [sampleResult], total_entries: 1 })
    expect(macroEventReader.calls).toEqual([{ view: 'admin' }])
  })

  it('repassa limit/offset da query pro motor', async () => {
    const { app, tokenIssuer, macroEventReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .get('/admin/macro-events?limit=5&offset=10')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(macroEventReader.calls).toEqual([{ limit: 5, offset: 10, view: 'admin' }])
  })

  it('retorna 400 para limit/offset inválidos', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .get('/admin/macro-events?limit=0')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})

const EVENT_ID = '9d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a99'

describe('POST /admin/macro-events com apply_on_day (N.11)', () => {
  it('repassa o dia agendado ao motor e o grava na auditoria', async () => {
    const { app, tokenIssuer, macroEventTrigger, auditLog } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validTemplateBody, apply_on_day: 130 })

    expect(res.status).toBe(201)
    expect(macroEventTrigger.calls[0]).toMatchObject({ apply_on_day: 130 })
    expect(auditLog.entries[0].payload).toMatchObject({ apply_on_day: 130 })
  })

  it.each([0, -3, 1.5, 'amanhã'])('apply_on_day %j retorna 400 sem chamar o motor', async (day) => {
    const { app, tokenIssuer, macroEventTrigger } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })
    const res = await request(app)
      .post('/admin/macro-events')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validTemplateBody, apply_on_day: day })
    expect(res.status).toBe(400)
    expect(macroEventTrigger.calls).toHaveLength(0)
  })
})

describe('GET /admin/macro-events com filtros (N.11)', () => {
  it('pede a visão do painel ao motor e repassa os filtros', async () => {
    const { app, tokenIssuer, macroEventReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .get('/admin/macro-events?status=cancelado&sector=Mineração&from_day=10&to_day=50&limit=5')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(macroEventReader.calls[0]).toEqual({
      view: 'admin',
      limit: 5,
      status: 'cancelado',
      sector: 'Mineração',
      from_day: 10,
      to_day: 50,
    })
  })

  it.each([
    'status=feito',
    'sector=A&risk_class=B',
    'asset_id=nao-uuid',
    'from_day=9&to_day=3',
    'from_day=-1',
  ])('filtro inválido (%s) retorna 400 sem chamar o motor', async (qs) => {
    const { app, tokenIssuer, macroEventReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })
    const res = await request(app)
      .get(`/admin/macro-events?${qs}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(macroEventReader.calls).toHaveLength(0)
  })
})

describe('GET /admin/macro-events/:id (N.11)', () => {
  it.each(['get', 'delete'] as const)(
    '%s retorna 401 sem token e 403 para usuário',
    async (method) => {
      const { app, tokenIssuer, macroEventAdmin, auditLog } = buildApp()
      expect((await request(app)[method](`/admin/macro-events/${EVENT_ID}`)).status).toBe(401)
      const user = tokenIssuer.issue({ sub: 'user-1', role: 'user' })
      const res = await request(app)
        [method](`/admin/macro-events/${EVENT_ID}`)
        .set('Authorization', `Bearer ${user}`)
      expect(res.status).toBe(403)
      expect(macroEventAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('devolve o detalhe com a versão que o usuário vê e repassa a janela', async () => {
    const { app, tokenIssuer, macroEventAdmin } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })
    const res = await request(app)
      .get(`/admin/macro-events/${EVENT_ID}?window_days=7`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(macroEventAdmin.detailCalls).toEqual([{ eventId: EVENT_ID, windowDays: 7 }])
    expect(res.body).toMatchObject({
      id: EVENT_ID,
      direction: 'negativo',
      publicly_visible: false,
      user_view: { direction: '', targets: [] },
    })
  })

  it.each([
    '/admin/macro-events/nao-uuid',
    `/admin/macro-events/${EVENT_ID}?window_days=0`,
    `/admin/macro-events/${EVENT_ID}?window_days=91`,
  ])('%s retorna 400 sem chamar o motor', async (path) => {
    const { app, tokenIssuer, macroEventAdmin } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })
    const res = await request(app).get(path).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(macroEventAdmin.calls).toHaveLength(0)
  })

  it('evento inexistente retorna 404', async () => {
    const { app, tokenIssuer, macroEventAdmin } = buildApp()
    macroEventAdmin.errorToThrow = new MacroEventNotFoundError('evento macro não encontrado')
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })
    const res = await request(app)
      .get(`/admin/macro-events/${EVENT_ID}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /admin/macro-events/:id (N.11)', () => {
  it('cancela, devolve o evento cancelado e audita', async () => {
    const { app, tokenIssuer, macroEventAdmin, auditLog } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })
    const res = await request(app)
      .delete(`/admin/macro-events/${EVENT_ID}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.event).toMatchObject({ id: EVENT_ID, status: 'cancelado' })
    expect(macroEventAdmin.cancelled).toEqual([EVENT_ID])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'macro_event.cancel',
      targetId: EVENT_ID,
      result: 'success',
    })
  })

  it('id que não é UUID retorna 400 sem chamar o motor nem auditar', async () => {
    const { app, tokenIssuer, macroEventAdmin, auditLog } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })
    const res = await request(app)
      .delete('/admin/macro-events/x')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(macroEventAdmin.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it.each([
    [new MacroEventConflictError('o evento já começou a produzir efeito'), 409],
    [new MacroEventNotFoundError('evento macro não encontrado'), 404],
  ])('mapeia %s para %i e audita a falha', async (error, status) => {
    const { app, tokenIssuer, macroEventAdmin, auditLog } = buildApp()
    macroEventAdmin.errorToThrow = error
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })
    const res = await request(app)
      .delete(`/admin/macro-events/${EVENT_ID}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(status)
    expect(res.body.error).toBe(error.message)
    expect(auditLog.entries[0]).toMatchObject({ result: 'failed' })
  })
})
