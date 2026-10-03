import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import {
  AdminOrderNotCancellableError,
  AdminOrderNotFoundError,
  BatchTooLargeError,
} from '../../domain/errors'
import { CancelAdminOrderUseCase } from '../../application/useCases/cancelAdminOrder'
import { CancelAdminOrdersBatchUseCase } from '../../application/useCases/cancelAdminOrdersBatch'
import { ListAdminOrdersUseCase } from '../../application/useCases/listAdminOrders'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeOrderAdmin, sampleAdminOrder } from '../../test/fakes/fakeOrderAdmin'
import { createAdminOrdersRouter } from './adminOrdersRouter'

const ORDER_ID = '7d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a11'
const ASSET_ID = '0d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a22'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const orderAdmin = createFakeOrderAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const app = express()
  app.use(express.json())
  app.use(
    createAdminOrdersRouter({
      listAdminOrders: new ListAdminOrdersUseCase(orderAdmin),
      cancelAdminOrder: new CancelAdminOrderUseCase(orderAdmin, record),
      cancelAdminOrdersBatch: new CancelAdminOrdersBatchUseCase(orderAdmin, record),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, orderAdmin, auditLog, adminToken, userToken }
}

const routes: Array<[string, 'get' | 'post', string, object?]> = [
  ['GET /admin/orders', 'get', '/admin/orders'],
  ['POST /admin/orders/:id/cancel', 'post', `/admin/orders/${ORDER_ID}/cancel`],
  ['POST /admin/orders/cancel-batch', 'post', '/admin/orders/cancel-batch', { asset_id: ASSET_ID }],
]

describe('rotas admin de ordens (N.10)', () => {
  it.each(routes)('%s retorna 401 sem token', async (_n, method, path, body) => {
    const { app } = buildApp()
    expect((await request(app)[method](path).send(body)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum, sem chamar o motor',
    async (_n, method, path, body) => {
      const { app, userToken, orderAdmin, auditLog } = buildApp()
      const res = await request(app)[method](path).set('Authorization', userToken()).send(body)
      expect(res.status).toBe(403)
      expect(orderAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('GET /admin/orders repassa os filtros e devolve a página', async () => {
    const { app, adminToken, orderAdmin } = buildApp()
    const res = await request(app)
      .get(`/admin/orders?asset_id=${ASSET_ID}&status=open&side=buy&limit=20&offset=40`)
      .set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ orders: [sampleAdminOrder], total: 1 })
    expect(orderAdmin.listQueries).toEqual([
      { asset_id: ASSET_ID, status: 'open', side: 'buy', limit: 20, offset: 40 },
    ])
  })

  it.each(['user_id=x', 'status=weird', 'side=hold', 'limit=201', 'offset=-1', 'from=ontem'])(
    'GET /admin/orders?%s retorna 400 sem chamar o motor',
    async (query) => {
      const { app, adminToken, orderAdmin } = buildApp()
      const res = await request(app)
        .get(`/admin/orders?${query}`)
        .set('Authorization', adminToken())
      expect(res.status).toBe(400)
      expect(orderAdmin.calls).toHaveLength(0)
    },
  )

  it('POST /admin/orders/:id/cancel cancela com 204 e audita', async () => {
    const { app, adminToken, orderAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post(`/admin/orders/${ORDER_ID}/cancel`)
      .set('Authorization', adminToken())
    expect(res.status).toBe(204)
    expect(orderAdmin.calls).toEqual([`cancel:${ORDER_ID}`])
    expect(auditLog.entries[0]).toMatchObject({ action: 'order.cancel', targetId: ORDER_ID })
  })

  it('POST /admin/orders/:id/cancel com id que não é UUID retorna 400', async () => {
    const { app, adminToken, orderAdmin } = buildApp()
    const res = await request(app)
      .post('/admin/orders/abc/cancel')
      .set('Authorization', adminToken())
    expect(res.status).toBe(400)
    expect(orderAdmin.calls).toHaveLength(0)
  })

  it('cancelamento mapeia 404 (inexistente) e 409 (já executada) e audita a falha', async () => {
    const { app, adminToken, orderAdmin, auditLog } = buildApp()
    orderAdmin.errorToThrow = new AdminOrderNotFoundError('ordem não encontrada')
    const notFound = await request(app)
      .post(`/admin/orders/${ORDER_ID}/cancel`)
      .set('Authorization', adminToken())
    expect(notFound.status).toBe(404)

    orderAdmin.errorToThrow = new AdminOrderNotCancellableError('ordem não pode ser cancelada')
    const conflict = await request(app)
      .post(`/admin/orders/${ORDER_ID}/cancel`)
      .set('Authorization', adminToken())
    expect(conflict.status).toBe(409)
    expect(auditLog.entries.map((e) => e.result)).toEqual(['failed', 'failed'])
  })

  it('POST /admin/orders/cancel-batch cancela, devolve os ids e audita uma linha', async () => {
    const { app, adminToken, orderAdmin, auditLog } = buildApp()
    const res = await request(app)
      .post('/admin/orders/cancel-batch')
      .set('Authorization', adminToken())
      .send({ asset_id: ASSET_ID })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ cancelled_count: 2, cancelled_ids: ['a', 'b'] })
    expect(orderAdmin.batchFilters).toEqual([{ assetId: ASSET_ID, userId: undefined }])
    expect(auditLog.entries).toHaveLength(1)
  })

  it.each([{}, { asset_id: 'x' }, { user_id: 5 }])(
    'cancel-batch com corpo %j retorna 400 sem chamar o motor',
    async (body) => {
      const { app, adminToken, orderAdmin } = buildApp()
      const res = await request(app)
        .post('/admin/orders/cancel-batch')
        .set('Authorization', adminToken())
        .send(body)
      expect(res.status).toBe(400)
      expect(orderAdmin.calls).toHaveLength(0)
    },
  )

  it('cancel-batch acima do teto retorna 422 com a contagem', async () => {
    const { app, adminToken, orderAdmin } = buildApp()
    orderAdmin.errorToThrow = new BatchTooLargeError('o filtro atinge 501 ordens', 501, 500)
    const res = await request(app)
      .post('/admin/orders/cancel-batch')
      .set('Authorization', adminToken())
      .send({ asset_id: ASSET_ID })
    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ code: 'batch_too_large', matched: 501, max: 500 })
  })
})

// N.22: ação destrutiva exige senha conferida há pouco (`authTime` recente).
describe('reautenticação em ações destrutivas', () => {
  it('POST /admin/orders/cancel-batch devolve 401 reauth_required com authTime antigo', async () => {
    const { app, auditLog } = buildApp()
    const staleToken = 'fake-token:admin-1:admin:1000'

    const res = await request(app)
      .post('/admin/orders/cancel-batch')
      .set('Authorization', `Bearer ${staleToken}`)
      .send({})

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'reauth_required' })
    expect((await auditLog.list({ limit: 10, offset: 0 })).entries).toHaveLength(0)
  })
})
