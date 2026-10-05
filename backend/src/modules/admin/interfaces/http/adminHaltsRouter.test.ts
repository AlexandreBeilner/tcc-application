import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import {
  TradingHaltConflictError,
  TradingHaltNotFoundError,
  TradingHaltRejectedError,
} from '../../domain/errors'
import { LiftTradingHaltUseCase } from '../../application/useCases/liftTradingHalt'
import { ListTradingHaltsUseCase } from '../../application/useCases/listTradingHalts'
import { PauseTradingUseCase } from '../../application/useCases/pauseTrading'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeTradingHaltAdmin, sampleHalt } from '../../test/fakes/fakeTradingHaltAdmin'
import { createAdminHaltsRouter } from './adminHaltsRouter'

const ASSET_ID = '0d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a22'
const HALT_ID = '9d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a99'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const tradingHaltAdmin = createFakeTradingHaltAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const app = express()
  app.use(express.json())
  app.use(
    createAdminHaltsRouter({
      listTradingHalts: new ListTradingHaltsUseCase(tradingHaltAdmin),
      pauseTrading: new PauseTradingUseCase(tradingHaltAdmin, record),
      liftTradingHalt: new LiftTradingHaltUseCase(tradingHaltAdmin, record),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, tradingHaltAdmin, auditLog, adminToken, userToken }
}

const routes: Array<[string, 'get' | 'post', string, object?]> = [
  ['GET /admin/halts', 'get', '/admin/halts'],
  ['POST /admin/halts', 'post', '/admin/halts', { scope: 'global', reason: 'm' }],
  ['POST /admin/halts/:id/lift', 'post', `/admin/halts/${HALT_ID}/lift`],
]

describe('rotas admin de pausa de negociação (N.9)', () => {
  it.each(routes)('%s retorna 401 sem token', async (_n, method, path, body) => {
    const { app } = buildApp()
    expect((await request(app)[method](path).send(body)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum, sem chamar o motor nem auditar',
    async (_n, method, path, body) => {
      const { app, userToken, tradingHaltAdmin, auditLog } = buildApp()
      const res = await request(app)[method](path).set('Authorization', userToken()).send(body)
      expect(res.status).toBe(403)
      expect(tradingHaltAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('GET /admin/halts devolve vigentes e histórico', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/halts').set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ active: [sampleHalt], recent: [] })
  })

  it('POST /admin/halts pausa um ativo, devolve 201 e audita', async () => {
    const { app, adminToken, tradingHaltAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post('/admin/halts')
      .set('Authorization', adminToken())
      .send({ scope: 'asset', asset_id: ASSET_ID, reason: '  volatilidade  ' })
    expect(res.status).toBe(201)
    expect(tradingHaltAdmin.paused[0]).toEqual({
      input: { scope: 'asset', assetId: ASSET_ID, reason: 'volatilidade' },
      adminId: 'admin-1',
    })
    expect(auditLog.entries[0]).toMatchObject({ action: 'trading.halt', result: 'success' })
  })

  it.each([
    {},
    { scope: 'global' },
    { scope: 'global', reason: '   ' },
    { scope: 'global', reason: 'x'.repeat(201) },
    { scope: 'asset', reason: 'm' },
    { scope: 'global', asset_id: ASSET_ID, reason: 'm' },
    { scope: 'asset', asset_id: 'nao-uuid', reason: 'm' },
    { scope: 'tudo', reason: 'm' },
  ])('POST /admin/halts com corpo %j retorna 400 sem chamar o motor', async (body) => {
    const { app, adminToken, tradingHaltAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post('/admin/halts')
      .set('Authorization', adminToken())
      .send(body)
    expect(res.status).toBe(400)
    expect(tradingHaltAdmin.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it.each([
    [new TradingHaltConflictError('já existe uma pausa vigente'), 409],
    [new TradingHaltNotFoundError('ativo não encontrado'), 404],
    [new TradingHaltRejectedError('o ativo não é negociável'), 400],
  ])('pause mapeia %s para %i e audita a falha', async (error, status) => {
    const { app, adminToken, tradingHaltAdmin, auditLog } = buildApp()
    tradingHaltAdmin.errorToThrow = error
    const res = await request(app)
      .post('/admin/halts')
      .set('Authorization', adminToken())
      .send({ scope: 'global', reason: 'm' })
    expect(res.status).toBe(status)
    expect(res.body.error).toBe(error.message)
    expect(auditLog.entries[0]).toMatchObject({ result: 'failed' })
  })

  it('POST /admin/halts/:id/lift retoma e audita quem retomou', async () => {
    const { app, adminToken, tradingHaltAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post(`/admin/halts/${HALT_ID}/lift`)
      .set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body.lifted_by).toBe('admin-1')
    expect(tradingHaltAdmin.lifted).toEqual([{ haltId: HALT_ID, adminId: 'admin-1' }])
    expect(auditLog.entries[0]).toMatchObject({ action: 'trading.resume', targetId: HALT_ID })
  })

  it('lift com id que não é UUID retorna 400 sem chamar o motor', async () => {
    const { app, adminToken, tradingHaltAdmin } = buildApp()
    const res = await request(app).post('/admin/halts/abc/lift').set('Authorization', adminToken())
    expect(res.status).toBe(400)
    expect(tradingHaltAdmin.calls).toHaveLength(0)
  })

  it('lift de pausa já encerrada devolve 409', async () => {
    const { app, adminToken, tradingHaltAdmin } = buildApp()
    tradingHaltAdmin.errorToThrow = new TradingHaltConflictError('a pausa já foi encerrada')
    const res = await request(app)
      .post(`/admin/halts/${HALT_ID}/lift`)
      .set('Authorization', adminToken())
    expect(res.status).toBe(409)
  })
})

// N.22: ação destrutiva exige senha conferida há pouco (`authTime` recente).
describe('reautenticação em ações destrutivas', () => {
  it('POST /admin/halts devolve 401 reauth_required com authTime antigo', async () => {
    const { app, auditLog } = buildApp()
    const staleToken = 'fake-token:admin-1:admin:1000'

    const res = await request(app)
      .post('/admin/halts')
      .set('Authorization', `Bearer ${staleToken}`)
      .send({})

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'reauth_required' })
    expect((await auditLog.list({ limit: 10, offset: 0 })).entries).toHaveLength(0)
  })
})
