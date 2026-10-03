import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import {
  BatchTooLargeError,
  BotConflictError,
  BotNotFoundError,
  BotRejectedError,
} from '../../domain/errors'
import { CreateAdminBotUseCase } from '../../application/useCases/createAdminBot'
import { FundAdminBotUseCase } from '../../application/useCases/fundAdminBot'
import { GetAdminBotActivityUseCase } from '../../application/useCases/getAdminBotActivity'
import { GetAdminBotsSummaryUseCase } from '../../application/useCases/getAdminBotsSummary'
import { ListAdminBotsUseCase } from '../../application/useCases/listAdminBots'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { UpdateAdminBotUseCase } from '../../application/useCases/updateAdminBot'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeBotAdmin, sampleBot } from '../../test/fakes/fakeBotAdmin'
import { createAdminBotsRouter } from './adminBotsRouter'

const BOT_ID = '0d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a33'
const ASSET_ID = '0d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a22'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const botAdmin = createFakeBotAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const app = express()
  app.use(express.json())
  app.use(
    createAdminBotsRouter({
      listAdminBots: new ListAdminBotsUseCase(botAdmin),
      createAdminBot: new CreateAdminBotUseCase(botAdmin, record),
      updateAdminBot: new UpdateAdminBotUseCase(botAdmin, record),
      fundAdminBot: new FundAdminBotUseCase(botAdmin, record),
      getAdminBotActivity: new GetAdminBotActivityUseCase(botAdmin),
      getAdminBotsSummary: new GetAdminBotsSummaryUseCase(botAdmin),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, botAdmin, auditLog, adminToken, userToken }
}

const validCreate = {
  archetype: 'chartista',
  sectors: ['Varejo'],
  asset_classes: ['fii'],
  within_scope_pct: 0.9,
  max_position_size_pct: 0.3,
  market_order_preference: 0.4,
  spread_width_pct: 0.02,
  initial_cash: 25000,
}

const routes: Array<[string, 'get' | 'post' | 'patch', string, object?]> = [
  ['GET /admin/bots', 'get', '/admin/bots'],
  ['POST /admin/bots', 'post', '/admin/bots', validCreate],
  ['PATCH /admin/bots/:id', 'patch', `/admin/bots/${BOT_ID}`, { is_active: false }],
  ['POST /admin/bots/:id/funding', 'post', `/admin/bots/${BOT_ID}/funding`, { cash: 100 }],
  ['GET /admin/bots/summary', 'get', '/admin/bots/summary'],
  ['GET /admin/bots/:id/activity', 'get', `/admin/bots/${BOT_ID}/activity`],
]

describe('rotas admin de bots (N.1)', () => {
  it.each(routes)('%s retorna 401 sem token', async (_n, method, path, body) => {
    const { app } = buildApp()
    expect((await request(app)[method](path).send(body)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum, sem chamar o motor nem auditar',
    async (_n, method, path, body) => {
      const { app, userToken, botAdmin, auditLog } = buildApp()
      const res = await request(app)[method](path).set('Authorization', userToken()).send(body)
      expect(res.status).toBe(403)
      expect(botAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('GET /admin/bots devolve os bots e os ativos sem cobertura', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/bots').set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      bots: [sampleBot],
      uncovered_assets: [{ asset_id: 'asset-2', ticker: 'BBB3' }],
    })
  })

  it('POST /admin/bots cria, devolve 201, completa listas ausentes e audita', async () => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post('/admin/bots')
      .set('Authorization', adminToken())
      .send(validCreate)
    expect(res.status).toBe(201)
    expect(botAdmin.created[0]).toMatchObject({
      archetype: 'chartista',
      sectors: ['Varejo'],
      riskClasses: [],
      assetClasses: ['fii'],
      withinScopePct: 0.9,
      initialCash: 25000,
    })
    expect(auditLog.entries[0]).toMatchObject({ action: 'bot.create', result: 'success' })
  })

  it.each([
    {},
    { ...validCreate, archetype: 'sniper' },
    { ...validCreate, sectors: ['Cripto'] },
    { ...validCreate, risk_classes: ['Arrojado'] },
    { ...validCreate, within_scope_pct: 0.5 },
    { ...validCreate, max_position_size_pct: 0 },
    { ...validCreate, spread_width_pct: 0.5 },
    { ...validCreate, initial_cash: 0 },
    { ...validCreate, initial_cash: 1_000_000_000_001 },
    { ...validCreate, max_covered_assets: 0 },
    { ...validCreate, knowledge_level: 1.5 },
  ])('POST /admin/bots com corpo %j retorna 400 sem chamar o motor', async (body) => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app).post('/admin/bots').set('Authorization', adminToken()).send(body)
    expect(res.status).toBe(400)
    expect(botAdmin.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it.each([
    [new BotRejectedError('escopo vazio'), 400],
    [new BotConflictError('conta já existe'), 409],
  ])('create mapeia %s para %i e audita a falha', async (error, status) => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    botAdmin.errorToThrow = error
    const res = await request(app)
      .post('/admin/bots')
      .set('Authorization', adminToken())
      .send(validCreate)
    expect(res.status).toBe(status)
    expect(res.body.error).toBe(error.message)
    expect(auditLog.entries[0]).toMatchObject({ action: 'bot.create', result: 'failed' })
  })

  it('PATCH /admin/bots/:id altera, audita e repassa só os campos informados', async () => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send({ is_active: false, covered_asset_ids: [ASSET_ID] })
    expect(res.status).toBe(200)
    expect(res.body.is_active).toBe(false)
    expect(botAdmin.updated[0]).toEqual({
      botId: BOT_ID,
      input: { isActive: false, maxCoveredAssets: undefined, coveredAssetIds: [ASSET_ID] },
    })
    expect(auditLog.entries[0]).toMatchObject({
      action: 'bot.update',
      targetId: BOT_ID,
      payload: { is_active: false, covered_asset_ids: [ASSET_ID] },
    })
  })

  it('PATCH com lista vazia de cobertura vale (tira toda a cobertura)', async () => {
    const { app, adminToken, botAdmin } = buildApp()
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send({ covered_asset_ids: [] })
    expect(res.status).toBe(200)
    expect(botAdmin.updated[0].input.coveredAssetIds).toEqual([])
  })

  it.each([
    {},
    { is_active: 'sim' },
    { max_covered_assets: 0 },
    { max_covered_assets: 1.5 },
    { covered_asset_ids: ['nao-uuid'] },
  ])('PATCH com corpo %j retorna 400 sem chamar o motor', async (body) => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send(body)
    expect(res.status).toBe(400)
    expect(botAdmin.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it('PATCH com id que não é UUID retorna 400 sem chamar o motor', async () => {
    const { app, adminToken, botAdmin } = buildApp()
    const res = await request(app)
      .patch('/admin/bots/abc')
      .set('Authorization', adminToken())
      .send({ is_active: true })
    expect(res.status).toBe(400)
    expect(botAdmin.calls).toHaveLength(0)
  })

  it.each([
    [new BotNotFoundError('bot não encontrado'), 404],
    [new BotConflictError('o ativo já é coberto por outro Market Maker'), 409],
    [new BotRejectedError('a cobertura passa do teto'), 400],
  ])('update mapeia %s para %i e audita a falha', async (error, status) => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    botAdmin.errorToThrow = error
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send({ is_active: true })
    expect(res.status).toBe(status)
    expect(auditLog.entries[0]).toMatchObject({ action: 'bot.update', result: 'failed' })
  })

  it('update com ordens demais pra cancelar devolve 422 batch_too_large', async () => {
    const { app, adminToken, botAdmin } = buildApp()
    botAdmin.errorToThrow = new BatchTooLargeError('acima do teto', 600, 500)
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send({ covered_asset_ids: [] })
    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ code: 'batch_too_large', matched: 600, max: 500 })
  })
})

describe('rotas de desempenho de bots (N.14)', () => {
  it('GET /admin/bots/:id/activity repassa o bot e a janela e não audita', async () => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app)
      .get(`/admin/bots/${BOT_ID}/activity?days=7`)
      .set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body.pnl).toBe(100)
    expect(botAdmin.activityAsks).toEqual([{ botId: BOT_ID, days: 7 }])
    expect(auditLog.entries).toHaveLength(0)
  })

  it('GET /admin/bots/:id/activity sem janela deixa o padrão ao motor', async () => {
    const { app, adminToken, botAdmin } = buildApp()
    await request(app).get(`/admin/bots/${BOT_ID}/activity`).set('Authorization', adminToken())
    expect(botAdmin.activityAsks).toEqual([{ botId: BOT_ID, days: undefined }])
  })

  it.each(['0', '-3', 'abc', '366'])(
    'GET /admin/bots/:id/activity recusa days=%s',
    async (days) => {
      const { app, adminToken, botAdmin } = buildApp()
      const res = await request(app)
        .get(`/admin/bots/${BOT_ID}/activity?days=${days}`)
        .set('Authorization', adminToken())
      expect(res.status).toBe(400)
      expect(botAdmin.calls).toEqual([])
    },
  )

  it('GET /admin/bots/:id/activity recusa id que não é UUID e traduz 404 do motor', async () => {
    const { app, adminToken, botAdmin } = buildApp()
    expect(
      (await request(app).get('/admin/bots/nao-uuid/activity').set('Authorization', adminToken()))
        .status,
    ).toBe(400)
    botAdmin.errorToThrow = new BotNotFoundError('bot não encontrado')
    const res = await request(app)
      .get(`/admin/bots/${BOT_ID}/activity`)
      .set('Authorization', adminToken())
    expect(res.status).toBe(404)
  })

  it('GET /admin/bots/summary devolve o resumo e repassa idle_days', async () => {
    const { app, adminToken, botAdmin } = buildApp()
    const res = await request(app)
      .get('/admin/bots/summary?idle_days=5')
      .set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body.idle_bots).toHaveLength(1)
    expect(botAdmin.summaryAsks).toEqual([5])
  })

  it('GET /admin/bots/summary recusa idle_days inválido', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app)
      .get('/admin/bots/summary?idle_days=0')
      .set('Authorization', adminToken())
    expect(res.status).toBe(400)
  })
})

describe('personalidade e aporte de bots (N.15)', () => {
  it('PATCH repassa os campos de personalidade e audita', async () => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send({
        sectors: ['Varejo', 'Energia'],
        risk_classes: [],
        asset_classes: ['fii'],
        within_scope_pct: 0.88,
        knowledge_level: 0.7,
        max_position_size_pct: 0.2,
        spread_width_pct: 0.03,
      })
    expect(res.status).toBe(200)
    expect(botAdmin.updated[0]).toEqual({
      botId: BOT_ID,
      input: {
        isActive: undefined,
        maxCoveredAssets: undefined,
        coveredAssetIds: undefined,
        sectors: ['Varejo', 'Energia'],
        riskClasses: [],
        assetClasses: ['fii'],
        withinScopePct: 0.88,
        knowledgeLevel: 0.7,
        maxPositionSizePct: 0.2,
        spreadWidthPct: 0.03,
      },
    })
    expect(auditLog.entries[0]).toMatchObject({ action: 'bot.update', result: 'success' })
  })

  it('PATCH descarta market_order_preference (achado 001: campo reservado, sem efeito)', async () => {
    const { app, adminToken, botAdmin } = buildApp()
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send({ spread_width_pct: 0.03, market_order_preference: 0.99 })
    expect(res.status).toBe(200)
    expect(JSON.stringify(botAdmin.updated[0].input)).not.toContain('0.99')
  })

  it('PATCH só com market_order_preference é recusado: nenhum campo editável', async () => {
    const { app, adminToken, botAdmin } = buildApp()
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send({ market_order_preference: 0.5 })
    expect(res.status).toBe(400)
    expect(botAdmin.calls).toHaveLength(0)
  })

  it.each([
    { within_scope_pct: 0.5 },
    { max_position_size_pct: 0 },
    { max_position_size_pct: 1.5 },
    { spread_width_pct: 0.5 },
    { spread_width_pct: -0.01 },
    { knowledge_level: 2 },
    { sectors: ['Cripto'] },
    { risk_classes: ['Arrojado'] },
    { asset_classes: ['cdb'] },
  ])('PATCH com %j retorna 400 sem chamar o motor', async (body) => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app)
      .patch(`/admin/bots/${BOT_ID}`)
      .set('Authorization', adminToken())
      .send(body)
    expect(res.status).toBe(400)
    expect(botAdmin.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it('POST /funding aporta caixa e posição, devolve o bot e audita bot.fund', async () => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post(`/admin/bots/${BOT_ID}/funding`)
      .set('Authorization', adminToken())
      .send({ cash: 5000, holdings: [{ asset_id: ASSET_ID, quantity: 40 }] })
    expect(res.status).toBe(200)
    expect(res.body.cash).toBe(sampleBot.cash + 5000)
    expect(botAdmin.funded).toEqual([
      { botId: BOT_ID, input: { cash: 5000, holdings: [{ assetId: ASSET_ID, quantity: 40 }] } },
    ])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'bot.fund',
      targetId: BOT_ID,
      result: 'success',
    })
  })

  it.each([
    {},
    { cash: 0 },
    { cash: -5 },
    { cash: 1_000_000_000_001 },
    { holdings: [] },
    { holdings: [{ asset_id: 'x', quantity: 1 }] },
    { holdings: [{ asset_id: ASSET_ID, quantity: 0 }] },
    { holdings: [{ asset_id: ASSET_ID, quantity: 1.5 }] },
    { holdings: [{ asset_id: ASSET_ID, quantity: 2_000_000_001 }] },
  ])('POST /funding com corpo %j retorna 400 sem chamar o motor', async (body) => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post(`/admin/bots/${BOT_ID}/funding`)
      .set('Authorization', adminToken())
      .send(body)
    expect(res.status).toBe(400)
    expect(botAdmin.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it('POST /funding recusa id que não é UUID', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app)
      .post('/admin/bots/nao-uuid/funding')
      .set('Authorization', adminToken())
      .send({ cash: 100 })
    expect(res.status).toBe(400)
  })

  it.each([
    [new BotRejectedError('ativo sem cotação'), 400],
    [new BotNotFoundError('bot não encontrado'), 404],
    [new BotConflictError('a posição passaria do total de cotas'), 409],
  ])('POST /funding mapeia %s para %i e audita a falha', async (error, status) => {
    const { app, adminToken, botAdmin, auditLog } = buildApp()
    botAdmin.errorToThrow = error
    const res = await request(app)
      .post(`/admin/bots/${BOT_ID}/funding`)
      .set('Authorization', adminToken())
      .send({ cash: 100 })
    expect(res.status).toBe(status)
    expect(auditLog.entries[0]).toMatchObject({ action: 'bot.fund', result: 'failed' })
  })
})
