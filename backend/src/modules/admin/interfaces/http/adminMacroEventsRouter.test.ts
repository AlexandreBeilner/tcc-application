import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { InvalidMacroEventError } from '../../domain/errors'
import { TriggerMacroEventUseCase } from '../../application/useCases/triggerMacroEvent'
import { ListMacroEventsUseCase } from '../../application/useCases/listMacroEvents'
import { createFakeMacroEventTrigger } from '../../test/fakes/fakeMacroEventTrigger'
import { createFakeMacroEventReader } from '../../test/fakes/fakeMacroEventReader'
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
  const triggerMacroEvent = new TriggerMacroEventUseCase(macroEventTrigger)
  const listMacroEvents = new ListMacroEventsUseCase(macroEventReader)
  const app = express()
  app.use(express.json())
  app.use(createAdminMacroEventsRouter({ triggerMacroEvent, listMacroEvents, authMiddleware }))
  return { app, tokenIssuer, macroEventTrigger, macroEventReader }
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
    expect(macroEventReader.calls).toEqual([{}])
  })

  it('repassa limit/offset da query pro motor', async () => {
    const { app, tokenIssuer, macroEventReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })

    const res = await request(app)
      .get('/admin/macro-events?limit=5&offset=10')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(macroEventReader.calls).toEqual([{ limit: 5, offset: 10 }])
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
